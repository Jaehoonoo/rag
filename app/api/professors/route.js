import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import OpenAI from "openai";
import axios from "axios";
import * as cheerio from "cheerio";


export async function POST(req) {
  const data = await req.json();
  const url = data.url

  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

  // Scrapes the URL to create a JSON object
  const response = await axios.get(url);
  const html = response.data;
  const $ = cheerio.load(html);

  const name = $('.cfjPUG').text().trim();
  const department = $('.iMmVHb').text().trim();

  const reviews = [];

  $('.Rating__StyledRating-sc-1rhvpxz-1', html).each(function () {
    const rating = $(this).find('.gcFhmN').text().trim();
    const difficulty = $(this).find('.cDKJcc').text().trim();
    const comment = $(this).find('.gRjWel').text().trim();
    reviews.push({
      rating,
      difficulty,
      comment,
    });
  });

  const professor = {
    name,
    department,
    reviews,
  };

  // Turns data into embeddings
  const processed_data = [];
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  const index = pc.index('rag')

  for (let i = 0; i < professor.reviews.length; i++) {
    const review = professor.reviews[i];
    // Wait for the embedding response
    const embeddingResponse = await client.embeddings.create({
      input: review.comment,
      model: "text-embedding-3-small",
    });

    // Check if embedding data is available
    if (embeddingResponse.data && embeddingResponse.data.length > 0) {
      const embedding = embeddingResponse.data[0].embedding;

      const data = {
        values: embedding,
        id: `${name}_${i}`,
        metadata: {
          department: department,
          rating: review.rating,
          difficulty: review.difficulty,
          comment: review.comment,
        },
      };
      await index.namespace('ns1').upsert([data])

    } else {
      console.error("Failed to generate embedding for:", review.comment);
    }
  }
  

  console.log(processed_data[0]);

  return NextResponse.json(
    { message: "Success" }, // Response body
    { status: 200 } // Optional configuration object
  );

}



// get link, scrape it, turn into embedding, upsert into pinecone, update memory msg
