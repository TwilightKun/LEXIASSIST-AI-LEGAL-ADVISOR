// src/app/api/agent/init/route.ts
import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { z } from 'zod';

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

// 1. Strict Input Validation Schema
const InitRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  clientId: z.string().uuid("Invalid Client ID"),
  fileUrl: z.string().url("Invalid File URL").optional(),
  hasPdf: z.boolean().default(false),
  metadata: z.object({
    jurisdiction: z.string().optional(),
    legalDomain: z.string().optional(),
    estimatedBudget: z.number().optional(),
  }).default({}),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 2. Validate Incoming Payload
    const parsedData = InitRequestSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        { error: 'Invalid payload structure', details: parsedData.error.format() },
        { status: 400 }
      );
    }

    const { prompt, clientId, fileUrl, hasPdf, metadata } = parsedData.data;

    // TODO: Replace with actual global DB session creation
    const sessionId = crypto.randomUUID(); 

    // 3. Construct Queue Payload
    const queuePayload = {
      sessionId,
      clientId,
      currentStep: 0,
      metadata,
      messages: [
        {
          role: 'user',
          content: hasPdf && fileUrl 
            ? `${prompt}\n\n[Attached File URL: ${fileUrl}]` 
            : prompt,
        }
      ],
    };

    // 4. Hardened Dynamic Host Resolution
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const forwardedProto = req.headers.get('x-forwarded-proto');
    
    let protocol = 'https://';
    if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
      protocol = 'http://';
    } else if (forwardedProto) {
      protocol = `${forwardedProto}://`;
    }

    const currentAppUrl = host 
      ? `${protocol}${host}` 
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

    // 5. Routing Fork: PDF Pre-Processing vs Standard Loop
    if (hasPdf && fileUrl) {
      console.log(`[INIT] File detected. Dispatching Session ${sessionId} to PDF Parser.`);
      await qstashClient.publishJSON({
        url: `${currentAppUrl}/api/agent/parse-pdf`,
        body: queuePayload,
        retries: 3,
      });
    } else {
      console.log(`[INIT] Text-only request. Dispatching Session ${sessionId} to Orchestration Loop.`);
      await qstashClient.publishJSON({
        url: `${currentAppUrl}/api/agent/loop`,
        body: queuePayload,
        retries: 3,
      });
    }

    // 6. Asynchronous 202 Release
    return NextResponse.json(
      { 
        message: 'Legal intake process accepted and queued.', 
        sessionId 
      },
      { status: 202 } 
    );

  } catch (error: any) {
    console.error('[INIT_ERROR] Failed to initialize agent sequence:', error);
    return NextResponse.json(
      { error: 'Internal Server Error during intake initialization', details: error?.message },
      { status: 500 }
    );
  }
}