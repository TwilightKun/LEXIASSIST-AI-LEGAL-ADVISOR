// src/app/api/agent/loop/route.ts
import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { buildLegalAgenticSystemPrompt } from '@/lib/ai/prompts/agent-prompt';
import { legalTools } from '@/lib/schemas/tools/legal-schemas';

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export const maxDuration = 60; 

export async function POST(req: Request) {
  try {
    // 1. Enforce Zero-Trust Signature Verification
    const signature = req.headers.get('upstash-signature');
    const rawBody = await req.text();
    
    const isValid = await receiver.verify({
      signature: signature || '',
      body: rawBody,
    }).catch(() => false);

    if (!isValid) {
      return new Response('Unauthorized Webhook Signature', { status: 401 });
    }

    // 2. Parse Stateless Payload
    const payload = JSON.parse(rawBody);
    const { sessionId, clientId, messages, currentStep, metadata } = payload;
    const MAX_STEPS = 5;

    // 3. Circuit Breaker Mechanism
    if (currentStep >= MAX_STEPS) {
      console.warn(`[LOOP] Circuit breaker activated for Session: ${sessionId}`);
      return new Response('Max step safety ceiling hit', { status: 200 });
    }

    // 4. Inject System Prompt (if it's the first step)
    const trackingMessages = [...messages];
    if (!trackingMessages.some((m: any) => m.role === 'system')) {
      trackingMessages.unshift({
        role: 'system',
        content: buildLegalAgenticSystemPrompt(),
      });
    }

    // 5. Invoke Gemini LLM for single-step reasoning using AI SDK Core
    const result = await generateText({
      model: google("gemini-2.5-pro"),
      messages: trackingMessages,
      tools: legalTools,
    });

    // 6. Modern AI SDK Destructuring
    // Extract the raw generation variables and the standardized response object
    const { finishReason, toolCalls, text, response } = result;

    // Append the newly generated assistant messages directly from the response object
    const updatedMessages = [...messages, ...response.messages];

    // 7. Dynamic URL Resolution
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
    const protocol = host && (host.includes('localhost') || host.includes('127.0.0.1')) ? 'http://' : 'https://';
    const currentAppUrl = host ? `${protocol}${host}` : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');

    // 8. The Hybrid Fork: Route using `finishReason`
    if (finishReason === 'tool-calls' || (toolCalls && toolCalls.length > 0)) {
      
      console.log(`[LOOP] Tool call requested. Dispatching to execute-tool worker.`);
      
      // STATE BRANCH A: Action required. Dispatch to secure tool executor.
      await fetch(`https://qstash.upstash.io/v1/publish/${currentAppUrl}/api/agent/execute-tool`, {
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
          toolCall: toolCalls[0], 
          currentStep: currentStep + 1,
          metadata,
        }),
      });

      return new Response('Transitioning to Action state', { status: 200 });
      
    } else if (finishReason === 'stop') {
      
      console.log(`[LOOP] Execution complete. Formulating final client response.`);
      
      // STATE BRANCH B: Conversational Chatbot Reply.
      // TODO: Save `text` to your database's case history table here.

      // TODO: Broadcast this final reply to the client UI via a real-time channel.

      return new Response('Agent process completed successfully', { status: 200 });
      
    } else {
      
      console.warn(`[LOOP] Unexpected finishReason: ${finishReason}`);
      return new Response('Execution interrupted by model constraints', { status: 200 });
      
    }

  } catch (error: any) {
    console.error('[LOOP_ERROR] Core orchestration failure:', error);
    return NextResponse.json(
      { error: 'Internal loop engine failure', details: error.message },
      { status: 500 }
    );
  }
}