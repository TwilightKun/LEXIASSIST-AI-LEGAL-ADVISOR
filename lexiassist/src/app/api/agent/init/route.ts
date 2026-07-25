// src/app/api/agent/init/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { Client } from '@upstash/qstash';
import { z } from 'zod';
import { getBaseUrl } from "@/lib/tools/actions/getBaseurl";
import { requireUser, requireRateLimited } from '@/lib/auth-helpers';
import { agentInitLimiter, agentInitDailyLimiter } from '@/lib/rate-limit';
import { JURISDICTIONS } from '@/lib/constants/jurisdictions';
import { LEGAL_DOMAINS } from '@/lib/schemas/tools/legal-schemas';
import { reportError } from '@/lib/error-reporting'; // <-- SENTRY IMPORT ADDED

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

// SECURITY FIX: jurisdiction and legalDomain now use strict Enums.
// This completely closes the prompt-injection vector by ensuring malformed
// or adversarial inputs are rejected with a 400 error before ever reaching the LLM.
const InitRequestSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty"),
  sessionId: z.string().uuid("Invalid Session ID").optional(),
  caseBriefId: z.string().uuid("Invalid Case Brief ID"),
  fileUrl: z.string().url("Invalid File URL").optional(),
  hasPdf: z.boolean().default(false),
  metadata: z.object({
    jurisdiction: z.enum(JURISDICTIONS).optional(),
    legalDomain: z.enum(LEGAL_DOMAINS).optional(),
    estimatedBudget: z.number().positive().optional(),
  }).default({}),
});

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const clientId = auth.session.user.id;

  // Enforce hourly burst limit
  const hourlyLimited = await requireRateLimited(agentInitLimiter, clientId);
  if (hourlyLimited) return hourlyLimited;

  // Enforce daily cost ceiling
  const dailyLimited = await requireRateLimited(agentInitDailyLimiter, clientId);
  if (dailyLimited) return dailyLimited;

  let activeSessionId: string | undefined = undefined;

  try {
    const body = await req.json();

    const parsedData = InitRequestSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        { error: 'Invalid payload structure', details: parsedData.error.format() },
        { status: 400 }
      );
    }

    const { prompt, sessionId: incomingSessionId, fileUrl, hasPdf, metadata } = parsedData.data;

    const newUserMessage = {
      role: 'user',
      content: hasPdf && fileUrl
        ? `${prompt}\n\n[Attached File URL: ${fileUrl}]`
        : prompt,
    };

    activeSessionId = incomingSessionId;
    let messagesHistory: any[] = [];

    if (activeSessionId) {
      const existingSession = await prisma.agentSession.findUnique({
        where: { id: activeSessionId },
      });

      if (!existingSession) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      if (existingSession.clientId !== clientId) {
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

      const brief = await prisma.caseBrief.findUnique({ where: { id: parsedData.data.caseBriefId } });
      if (!brief || brief.clientId !== clientId) {
        return NextResponse.json({ error: 'Case not found or does not belong to this client' }, { status: 404 });
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

    const queuePayload = {
      sessionId: activeSessionId,
      clientId,
      currentStep: 0,
      metadata,
      messages: messagesHistory,
    };

    const currentAppUrl = getBaseUrl(req);

    if (hasPdf && fileUrl) {
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

    return NextResponse.json(
      {
        message: 'Legal intake process accepted and queued.',
        sessionId: activeSessionId
      },
      { status: 202 }
    );

  } catch (error: any) {
    // SENTRY EXCEPTION LOGGING REPLACES CONSOLE.ERROR
    reportError(error, { route: 'agent/init', sessionId: activeSessionId });
    return NextResponse.json(
      { error: 'Internal Server Error during intake initialization', details: error?.message },
      { status: 500 }
    );
  }
}