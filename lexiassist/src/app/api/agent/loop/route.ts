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
    
    // 3. Circuit Breaker Mechanism
    const MAX_STEPS = 5;
    if (currentStep >= MAX_STEPS) {
      console.warn(`[LOOP] Circuit breaker activated for Session: ${sessionId}`);
      return new Response('Max step safety ceiling hit', { status: 200 });
    }

    // 4. Generate the Immutable System Instruction
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

    // 5. Invoke Gemini LLM
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      system: dynamicSystemInstruction,
      messages: messages, 
      tools: legalTools,
    });

    const { finishReason, toolCalls, text } = result;
    let updatedMessages = [...messages];


   // 6. Handle Tool Call State Persistence (Parallel Support)
    if (toolCalls && toolCalls.length > 0) {
      const toolCallParts = toolCalls.map((tool: any) => {
        const toolArgs = tool.args ?? tool.input;
        if (!toolArgs) {
          throw new Error(`Tool ${tool.toolName} returned no arguments.`);
        }
        return {
          type: 'tool-call',
          toolCallId: tool.toolCallId,
          toolName: tool.toolName,
          input: toolArgs,
        };
      });

      // Persist ALL tool calls in a single assistant message
      updatedMessages.push({
        role: 'assistant',
        content: toolCallParts,
      });
    }

    // 7. Hardened Dynamic Host Resolution
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

    // 8. The Routing Fork: Dispatch vs. Stop (Parallel Support)
    if (finishReason === 'tool-calls' || (toolCalls && toolCalls.length > 0)) {
      
      const mappedToolCalls = toolCalls.map((tool: any) => ({
        toolName: tool.toolName,
        toolCallId: tool.toolCallId,
        args: tool.args ?? tool.input,
      }));

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
          toolCalls: mappedToolCalls, // Passing the array instead of a single object
          currentStep: currentStep + 1,
          metadata,
        }),
      });

      console.log(`[LOOP] Dispatched ${mappedToolCalls.length} tool calls in batch (Status ${dispatch.status})`);
      return new Response('Transitioning to Action state', { status: 200 });
      
      
    } else if (finishReason === 'stop') {
      
      const clientSafeText = text.replace(/<scratchpad>[\s\S]*?<\/scratchpad>/g, '').trim();
      console.log(`[LOOP] Execution complete. Session: ${sessionId}`);
      
      return NextResponse.json({
        status: 'success',
        sessionId,
        content: clientSafeText,
        metadata: {
          step: currentStep,
          timestamp: new Date().toISOString()
        }
      }, { status: 200 });
      
    } else {
      console.warn(`[LOOP] Unexpected finishReason encountered: ${finishReason}`);
      return new Response('Execution interrupted by model constraints', { status: 200 });
    }

  } catch (error: any) {
    console.error('[LOOP_ERROR] Core orchestration failure:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Internal loop engine failure' },
      { status: 500 }
    );
  }
}