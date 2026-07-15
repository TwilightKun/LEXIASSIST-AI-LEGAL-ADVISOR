// src/app/api/agent/init/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { z } from 'zod';
import { getBaseUrl } from "@/lib/tools/actions/getBaseurl"

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

// 1. Dev-Relaxed Input Validation Schema
const InitRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  clientId: z.string().min(1, "Invalid Client ID"),
  sessionId: z.string().optional(), 
  caseBriefId: z.string().min(1, "Invalid Case Brief ID"),
  fileUrl: z.string().url("Invalid File URL").optional(),
  hasPdf: z.boolean().default(false),
  
  metadata: z.object({
    jurisdiction: z.string().optional(),
    legalDomain: z.string().optional(),
    estimatedBudget: z.number().optional(),
    isSystemInjection: z.boolean().optional(), //Prevents Zod from deleting your frontend flag
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

    const { prompt, clientId, sessionId: incomingSessionId, fileUrl, hasPdf, metadata } = parsedData.data;

    // Extract fileUrl from the prompt if it wasn't passed directly in the JSON root
    let actualFileUrl = fileUrl;
    if (hasPdf && !actualFileUrl) {
      const urlMatch = prompt.match(/\[Attached File URL: (.+?)\]/);
      actualFileUrl = urlMatch?.[1];
    }

    // Just use the prompt directly, because frontend already appended the URL cleanly
    const newUserMessage = {
      role: 'user',
      content: prompt,
    };

    let activeSessionId = incomingSessionId;
    let messagesHistory: any[] = [];

    // 4. State Rehydration & DB Operations
    if (activeSessionId) {
      const existingSession = await prisma.agentSession.findUnique({
        where: { id: activeSessionId },
      });

      if (!existingSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      if (existingSession.status === 'PROCESSING') {
        return NextResponse.json(
          { error: 'Session is currently processing a previous turn. Please wait for a response.' },
          { status: 409 }
        );
      }

      messagesHistory = existingSession.messages
        ? (existingSession.messages as any[])
        : [];

      messagesHistory.push(newUserMessage);

      await prisma.agentSession.update({
        where: { id: activeSessionId },
        data: {
          status: 'PROCESSING',
          messages: messagesHistory, 
        }
      });

    } else {
      messagesHistory = [newUserMessage];

      if (parsedData.data.caseBriefId) {
        const brief = await prisma.caseBrief.findUnique({ where: { id: parsedData.data.caseBriefId } });
        if (!brief || brief.clientId !== clientId) {
          return NextResponse.json({ error: 'Case not found or does not belong to this client' }, { status: 404 });
        }
      }

      const newSession = await prisma.agentSession.create({
        data: {
          clientId,
          status: 'PROCESSING',
          messages: messagesHistory,
          metadata: metadata as any,
          caseBriefId: parsedData.data.caseBriefId ?? null
        }
      });
      activeSessionId = newSession.id;
    }

    // 5. Construct Queue Payload for the Hot Network Loop
    const queuePayload = {
      sessionId: activeSessionId,
      clientId,
      currentStep: 0,
      metadata,
      messages: messagesHistory, 
    };

    //  Ngrok tunnel override for local development routing
    const isDevelopment = process.env.NODE_ENV === 'development';
    const currentAppUrl = isDevelopment 
      ? 'https://gender-partly-cash.ngrok-free.dev'
      : getBaseUrl(req);

    // Use the actualFileUrl we extracted to trigger the routing fork correctly
    if (hasPdf && actualFileUrl) {
      console.log(`[INIT] File detected. Dispatching Session ${activeSessionId} to PDF Parser.`);
      await qstashClient.publishJSON({
        url: `${currentAppUrl}/api/agent/parse-pdf`,
        body: queuePayload,
        retries: 3,
      });
    } else {
      console.log(`[INIT] Text-only request. Dispatching Session ${activeSessionId} to Orchestration Loop.`);
      await qstashClient.publishJSON({
        url: `${currentAppUrl}/api/agent/loop`,
        body: queuePayload,
        retries: 3,
      });
    }

    // 8. Asynchronous 202 Release
    return NextResponse.json(
      {
        message: 'Legal intake process accepted and queued.',
        sessionId: activeSessionId
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