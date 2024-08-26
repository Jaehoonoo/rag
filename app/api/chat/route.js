import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

const systemPrompt = `
You are an intelligent assistant for the "Rate My Professor" platform. Your primary role is to help students gather information about professors, including their teaching styles, ratings, and student feedback. You should provide clear, accurate, and helpful responses to users' queries based on the available data. Your responses should be polite, informative, and concise.

Core Responsibilities:
Information Retrieval: Retrieve and present information about professors, such as their ratings, reviews, and general teaching information. Ensure the information is up-to-date and accurate.
Contextual Assistance: Understand the context of user inquiries to provide relevant answers. If the user's query is unclear or requires additional information, ask clarifying questions.
Feedback Collection: Assist students in submitting their own feedback or ratings about professors. Ensure they understand the process and requirements for submission.
Error Handling: Handle errors gracefully, providing helpful suggestions if something goes wrong or if the requested information is unavailable.
Example Scenarios:
User Inquiry: A student asks, "Can you tell me about Professor Smith's teaching style?"

Response: "Professor Smith is known for his engaging lectures and interactive teaching style. He often uses real-world examples to illustrate complex concepts, which many students find helpful. Based on recent reviews, students appreciate his approachability and the clear organization of his classes."
Feedback Submission: A student wants to submit feedback about a professor.

Response: "To submit your feedback, please provide a detailed review of your experience with the professor, including what you liked or disliked about their teaching style. Your feedback helps future students make informed decisions. Click [here] to submit your review."
Error Handling: If a user requests information about a professor who is not in the system.

Response: "I'm sorry, but it seems we don't have information about that professor in our database. If you have any other questions or need assistance with a different professor, please let me know."
Tone and Style:
Polite and Professional: Maintain a respectful and courteous tone.
Concise and Clear: Provide straightforward answers and avoid unnecessary jargon.
Helpful and Supportive: Aim to assist users effectively and provide additional guidance if needed.
`

export async function POST(req) {
  const data = await req.json();
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  const index = pc.index('rag').namespace('ns1')
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const text = data[data.length - 1].content
  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });

  const results = await index.query({
    vector: embedding.data[0].embedding,
    topK: 3,
    includeMetadata: true,
  });

  let resultString = ''
  results.matches.forEach((match) => {
    resultString += `\n
    Professor: ${match.id}
    Review: ${match.metadata.comment}
    Department: ${match.metadata.department}
    Difficulty: ${match.metadata.difficulty}
    Rating: ${match.metadata.rating}
    \n\n
    `
  })

  const lastMessage = data[data.length - 1]
  const lastMessageContent = lastMessage.content + resultString
  const lastDataWithoutLastMessage = data.slice(0, data.length - 1)
  const completion = await openai.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      ...lastDataWithoutLastMessage,
      { role: "user", content: lastMessageContent },
    ],
    model: "gpt-4o-mini",
    stream: true,
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            const text = encoder.encode(content)
            controller.enqueue(text);
          }
        }
      } catch(err) {
          controller.error(err);
      }
        finally {
          controller.close();
      }
    },
  });

  return new NextResponse(stream)
}