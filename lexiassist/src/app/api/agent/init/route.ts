// src/app/api/agent/init/route.ts
import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { z } from 'zod';

// Initialize QStash Client
// QSTASH_TOKEN is automatically picked up from your .env file
const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

// 1. Strict Input Validation Schema
// We use Zod to guarantee the frontend sends exactly what we expect.
const InitRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  clientId: z.string().uuid("Invalid Client ID"),
  fileUrl: z.string().url("Invalid File URL").optional(),
  metadata: z.object({
    jurisdiction: z.string().optional(),
    legalDomain: z.string().optional(),
    estimatedBudget: z.number().optional(),
  }).default({}),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Validate the incoming payload securely
    const parsedData = InitRequestSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        { error: 'Invalid payload structure', details: parsedData.error.format() },
        { status: 400 }
      );
    }

    const { prompt, clientId, fileUrl, metadata } = parsedData.data;

    // 2. Database Insertion (Session Creation)
    // Here you would use your global DB singleton to create a new case session
    // const session = await db.caseSession.create({ data: { clientId, status: 'INITIALIZING' } });
    
    // For this implementation, we will generate a secure mock UUID
    const sessionId = crypto.randomUUID(); 

    // 3. Construct the Standardized Queue Payload
    const queuePayload = {
      sessionId,
      clientId,
      currentStep: 0,
      metadata,
      messages: [
        {
          role: 'user',
          content: fileUrl 
            ? `${prompt}\n\n[Attached File URL: ${fileUrl}]` 
            : prompt,
        }
      ],
    };

    const baseUrl = process.env.APP_URL || 'http://localhost:3000';

    // 4. The Routing Fork: PDF Pre-Processing vs Standard Loop
    if (fileUrl) {
      console.log(`[INIT] File detected. Dispatching Session ${sessionId} to PDF Parser Worker.`);
      await qstashClient.publishJSON({
        url: `${baseUrl}/api/agent/parse-pdf`,
        body: queuePayload,
        retries: 3, // Exponential backoff if the PDF parser times out
      });
    } else {
      console.log(`[INIT] Text-only request. Dispatching Session ${sessionId} to Orchestration Loop.`);
      await qstashClient.publishJSON({
        url: `${baseUrl}/api/agent/loop`,
        body: queuePayload,
        retries: 3,
      });
    }

    // 5. Instantly release the client connection
    return NextResponse.json(
      { 
        message: 'Legal intake process accepted and queued.', 
        sessionId 
      },
      { status: 202 } 
    );

  } catch (error) {
    console.error('[INIT_ERROR] Failed to initialize agent sequence:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during intake initialization' },
      { status: 500 }
    );
  }
}