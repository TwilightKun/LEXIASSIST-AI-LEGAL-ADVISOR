// src/lib/schemas/frontend-contract.ts
import { z } from 'zod';

// QStash pushes this event when the agent is 'thinking' or executing a tool
export const AgentProgressEventSchema = z.object({
  step: z.string(),
  timestamp: z.string().datetime(),
});

export type AgentProgressEvent = z.infer<typeof AgentProgressEventSchema>;

// QStash pushes this event when the final answer is ready
export const AgentCompletedEventSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.literal('COMPLETED'),
  content: z.string(), // The final text for the UI
  metadata: z.object({
    step: z.number(),
    timestamp: z.string().datetime(),
  }),
});

export type AgentCompletedEvent = z.infer<typeof AgentCompletedEventSchema>;