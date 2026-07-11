// src/app/api/agent/execute-tool/route.ts
import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';

import {
  extractCaseChronologySchema,
  generatePreBriefRiskSchema,
  generateDocumentRedlinesSchema,
  matchVerifyLawyerSchema
} from '@/lib/schemas/tools/legal-schemas';

// Import decoupled tool actions
import { executeExtractCaseChronology } from '@/lib/tools/actions/extract-case-chronology';
import { executeGeneratePreBriefRisk } from '@/lib/tools/actions/generate-pre-brief-risk';
import { executeGenerateDocumentRedlines } from '@/lib/tools/actions/generate-document-redlines';
import { executeMatchVerifyLawyer } from '@/lib/tools/actions/match-verify-lawyer';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: Request) {
  try {
    // 1. Enforce Cryptographic Signature Verification (Zero-Trust)
    const signature = req.headers.get('upstash-signature');
    const rawBody = await req.text();

    const isValid = await receiver.verify({
      signature: signature || '',
      body: rawBody,
    }).catch(() => false);

    if (!isValid) {
      return new Response('Unauthorized Webhook Signature', { status: 401 });
    }

    // 2. Parse and Validate Payload
    const payload = JSON.parse(rawBody);

    // Fallback to payload.toolCall for backward compatibility during deployment
    const activeToolCalls = payload.toolCalls || (payload.toolCall ? [payload.toolCall] : null);

    if (!activeToolCalls || activeToolCalls.length === 0) {
      return NextResponse.json(
        { error: "Missing toolCalls in execute-tool payload" },
        { status: 400 }
      );
    }

    const { sessionId, clientId, messages, currentStep, metadata } = payload;

    const toolNames = activeToolCalls.map((t: any) => t.toolName).join(', ');
    console.log(`[EXECUTE-TOOL] Executing Batch: [${toolNames}] | Session: ${sessionId}`);

    // 3. Decentralized Execution Router with Strict Zod Parsing
    const toolResultContent = [];

    for (const tool of activeToolCalls) {
      const { toolName, toolCallId, args } = tool;
      let toolExecutionResult = {};

      try {
        switch (toolName) {
          case 'extractCaseChronology':
            toolExecutionResult = await executeExtractCaseChronology(extractCaseChronologySchema.parse(args));
            break;
          case 'generatePreBriefRisk':
            toolExecutionResult = await executeGeneratePreBriefRisk(generatePreBriefRiskSchema.parse(args));
            break;
          case 'generateDocumentRedlines':
            toolExecutionResult = await executeGenerateDocumentRedlines(generateDocumentRedlinesSchema.parse(args));
            break;
          case 'matchVerifyLawyer':
            toolExecutionResult = await executeMatchVerifyLawyer(matchVerifyLawyerSchema.parse(args));
            break;
          default:
            toolExecutionResult = { error: `Unknown tool requested: ${toolName}` };
        }
      } catch (e: any) {
        console.error(`[EXECUTE-TOOL] Error in ${toolName}:`, e);
        toolExecutionResult = { error: e.message };
      }

      // Pack into the required AI SDK discriminator format
      toolResultContent.push({
        type: "tool-result",
        toolCallId,
        toolName,
        output: {
          type: "json",
          value: toolExecutionResult,
        },
      });
    }


    const updatedMessages = [...messages];

    // Check if ANY of the tools in this batch were already recorded (prevents QStash retry duplication)
    const firstToolId = activeToolCalls[0].toolCallId;
    const alreadyExists = updatedMessages.some((m: any) =>
      m.role === "tool" &&
      Array.isArray(m.content) &&
      m.content.some((c: any) => c.type === "tool-result" && c.toolCallId === firstToolId)
    );

    if (!alreadyExists) {
      updatedMessages.push({
        role: "tool",
        content: toolResultContent
      });
    }

    // 6. Dynamic Tunnel & Production Host Resolution
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

    // 7. Chain State Machine Back to Orchestration Loop
    const publish = await fetch(
      `https://qstash.upstash.io/v2/publish/${currentAppUrl}/api/agent/loop`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          clientId,
          messages: updatedMessages,
          currentStep,
          metadata,
        }),
      }
    );

    if (!publish.ok) {
      const body = await publish.text();
      throw new Error(`Loop dispatch failed (${publish.status}): ${body}`);
    }

    console.log(`[EXECUTE-TOOL] Success: State returned to loop (Status ${publish.status})`);

    return NextResponse.json({
      success: true,
      tool: toolNames,
      sessionId,
    });

  } catch (error: any) {
    console.error('[EXECUTE-TOOL ERROR] Asynchronous execution breakdown:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Internal operation failure' },
      { status: 500 }
    );
  }
}