// src/app/api/agent/loop/route.ts
import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import Pusher from 'pusher';
import { prisma } from '@/lib/prisma';
import { buildLegalAgenticSystemPrompt } from '@/lib/ai/prompts/agent-prompt';
import { legalTools } from '@/lib/schemas/tools/legal-schemas';
import { reportError } from '@/lib/error-reporting';


const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export const maxDuration = 60; 

export async function POST(req: Request) {
  let activeSessionId: string | null = null; // Track session ID for error handling

  try {
    const signature = req.headers.get('upstash-signature');
    const rawBody = await req.text();
    
    const isValid = await receiver.verify({
      signature: signature || '',
      body: rawBody,
    }).catch(() => false);

    if (!isValid) return new Response('Unauthorized Webhook Signature', { status: 401 });

    const payload = JSON.parse(rawBody);
    const { sessionId, clientId, messages, currentStep, metadata } = payload;
    activeSessionId = sessionId;
    
    // 1. Circuit Breaker
    const MAX_STEPS = 5;
    if (currentStep >= MAX_STEPS) {
      console.warn(`[LOOP] Circuit breaker activated for Session: ${sessionId}`);
      
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { status: 'FAILED', content: 'Agent exceeded maximum execution steps.' }
      });
      
      await pusher.trigger(`session-${sessionId}`, 'agent:completed', {
        sessionId, status: 'FAILED', content: 'System safety limits reached.'
      });

      return new Response('Max step safety ceiling hit', { status: 200 });
    }

    // 2. Build the System Prompt
    const systemInstruction = buildLegalAgenticSystemPrompt();
    const dynamicSystemInstruction = `
${systemInstruction}

# ACTIVE RUNTIME CONTEXT
You must use these exact system values to populate tool parameters when executing actions. Do not ask the user for these values:
- Current Case Session ID (caseSessionId): "${sessionId}"
- Client ID (clientId): "${clientId}"
- Target Litigation Jurisdiction: "${metadata?.jurisdiction || 'Not Specified'}"
- Target Legal Domain Specialist: "${metadata?.legalDomain || 'Not Specified'}"

# MANDATORY TOOL EXECUTION
The user has requested a "legal risk assessment". You MUST execute the 'generatePreBriefRisk' tool to fulfill this request. Do not attempt to summarize or assess risks in your final text response without first invoking the 'generatePreBriefRisk' tool to generate the structural data.
`;

    // 3. Invoke Gemini LLM
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: dynamicSystemInstruction,
      messages: messages, 
      tools: legalTools,
    });

    const { finishReason, toolCalls, text } = result;
    let updatedMessages = [...messages];

    // 4. Handle Tool Call Persistence (Parallel Batching Support)
    if (toolCalls && toolCalls.length > 0) {
      const toolCallParts = toolCalls.map((tool: any) => {
        const toolArgs = tool.args ?? tool.input;
        if (!toolArgs) throw new Error(`Tool ${tool.toolName} returned no arguments.`);
        return {
          type: 'tool-call',
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          input: toolArgs,
        };
      });

      updatedMessages.push({ role: 'assistant', content: toolCallParts });
    }

    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const forwardedProto = req.headers.get('x-forwarded-proto');
    let protocol = host && (host.includes('localhost') || host.includes('127.0.0.1')) ? 'http://' : (forwardedProto ? `${forwardedProto}://` : 'https://');
    const currentAppUrl = host ? `${protocol}${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');


    // 5. The Routing Fork
    if (finishReason === 'tool-calls' || (toolCalls && toolCalls.length > 0)) {
      
      const mappedToolCalls = toolCalls.map((tool: any) => ({
        toolName: tool.toolName,
        toolCallId: tool.toolCallId,
        args: tool.args ?? tool.input,
      }));

      // Hot Network Loop: Dispatch back to QStash WITHOUT hitting the database
      const dispatch = await fetch(`https://qstash.upstash.io/v2/publish/${currentAppUrl}/api/agent/execute-tool`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Upstash-Max-Retries': '3', 
        },
        body: JSON.stringify({
          sessionId,
          clientId,
          messages: updatedMessages,
          toolCalls: mappedToolCalls,
          currentStep: currentStep + 1,
          metadata,
        }),
      });

      console.log(`[LOOP] Dispatched batch to worker (Status ${dispatch.status})`);
      return new Response('Transitioning to Action state', { status: 200 });
      
    } else if (finishReason === 'stop') {
      
      // 6. Terminal State: Append the raw text to history to preserve scratchpad context for future turns
      updatedMessages.push({ role: 'assistant', content: text });
      
      const clientSafeText = text.replace(/<scratchpad>[\s\S]*?<\/scratchpad>/g, '').trim();
      console.log(`[LOOP] Execution complete. Saving to DB. Session: ${sessionId}`);

      // Pull the last tool-result from this turn, if any, so the frontend
      // gets structured data alongside the prose — e.g. lawyer candidates
      // to render as selectable cards, not something to parse out of text.
      const lastToolResult = updatedMessages
        .slice()
        .reverse()
        .find((m: any) => m.role === 'tool')
        ?.content?.[0]?.output?.value;
      
      // 7. Terminal Database Write
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          content: clientSafeText,
          messages: updatedMessages, // Save the complete conversational state
        }
      });

      // 8. Blast the final payload to the frontend via WebSockets
      const finalPayload = {
        sessionId,
        status: 'COMPLETED',
        content: clientSafeText,
        structuredData: lastToolResult ?? null, // { matchFound, matches: [...] } when relevant
        metadata: {
          step: currentStep,
          timestamp: new Date().toISOString()
        }
      };

      await pusher.trigger(`session-${sessionId}`, 'agent:completed', finalPayload)
        .catch(e => console.error("[PUSHER ERROR]", e));

      return NextResponse.json({ status: 'success' }, { status: 200 });
      
    } else {
      return new Response('Execution interrupted', { status: 200 });
    }

  } catch (error: any) {
    // SENTRY EXCEPTION LOGGING REPLACES CONSOLE.ERROR
    reportError(error, { route: 'agent/loop', sessionId: activeSessionId ?? undefined });
    
    // Safety Net: Mark session as failed in DB if the loop crashes entirely
    if (activeSessionId) {
      await prisma.agentSession.update({
        where: { id: activeSessionId },
        data: { status: 'FAILED' }
      }).catch(e => console.error('Failed to update session failure status:', e));
      
      await pusher.trigger(`session-${activeSessionId}`, 'agent:completed', {
        sessionId: activeSessionId, status: 'FAILED'
      }).catch(e => {});
    }

    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}