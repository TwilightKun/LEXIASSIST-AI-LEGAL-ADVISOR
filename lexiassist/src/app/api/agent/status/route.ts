// src/app/api/agent/status/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSessionAccess } from '@/lib/auth-helpers';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
  }

  // SECURITY FIX: Prevent unauthorized access to the session status
  const auth = await requireSessionAccess(sessionId);
  if (!auth.ok) return auth.response;

  try {
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: session.status,
      content: session.content,
      metadata: session.metadata,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 });
  }
}