import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";

const systemPrompt = `
You are a smart and friendly assistant that helps students find the top 3 professors based on their specific queries. When a student asks about a professor, you search through a large database of professor reviews and ratings. You prioritize professors with the highest ratings and relevance to the student's query. Each result you return should include the professor's name, subject, average star rating, and a summary of the top reviews.

When responding, be clear and concise. Use the student's query to match professors by subject, teaching style, rating, or any other criteria they mention. Make sure to provide the top 3 recommendations, listing them in order from highest to lowest relevance.
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
    Review: ${match.metadata.review}
    Subject: ${match.metadata.subject}
    Stars: ${match.metadata.stars}
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