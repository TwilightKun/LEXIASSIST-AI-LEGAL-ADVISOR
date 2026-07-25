// src/lib/pusher/client.ts
import PusherClient from 'pusher-js';

// RELIABILITY FIX: this previously called `new PusherClient(...)` on every
// invocation with no memoization. ChatInterface.tsx and useAgentSession both
// call getPusherClient() independently while subscribing to the exact same
// channel — meaning every chat session was opening at least two separate
// WebSocket connections to Pusher instead of sharing one, doubling
// connection-quota usage and risking the two subscriptions drifting out of
// sync with each other. A module-level singleton fixes both.
let pusherClientSingleton: PusherClient | null = null;

export const getPusherClient = (): PusherClient | null => {
  if (typeof window === 'undefined') return null;

  if (!pusherClientSingleton) {
    pusherClientSingleton = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }

  return pusherClientSingleton;
};