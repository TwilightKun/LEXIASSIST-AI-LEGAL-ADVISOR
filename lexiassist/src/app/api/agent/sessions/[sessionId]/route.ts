// src/app/api/agent/sessions/[sessionId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSessionAccess } from '@/lib/auth-helpers';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const resolvedParams = await params;
  const sessionId = resolvedParams.sessionId;

  // SECURITY FIX: This was a fully open read before. Now, it verifies that
  // the logged-in user actually owns (or is the assigned lawyer for) this session.
  const auth = await requireSessionAccess(sessionId);
  if (!auth.ok) return auth.response;

  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
    include: {
      caseBrief: {
        include: {
          documents: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    status: session.status,
    content: session.content,
    messageCount: Array.isArray(session.messages) ? (session.messages as any[]).length : 0,
    caseBrief: session.caseBrief
      ? {
          id: session.caseBrief.id,
          title: session.caseBrief.title,
          status: session.caseBrief.status,
          estimatedValue: session.caseBrief.estimatedValue,
          aiRiskAnalysis: session.caseBrief.aiRiskAnalysis,
          aiTimeline: session.caseBrief.aiTimeline,
          aiEntities: session.caseBrief.aiEntities,
          documents: session.caseBrief.documents.map((d) => ({
            id: d.id,
            fileUrl: d.fileUrl,
            extractedTextLength: d.extractedText?.length ?? 0,
            extractedTextPreview: d.extractedText?.slice(0, 200) ?? '',
            redlines: d.redlines,
          })),
        }
      : null,
    updatedAt: session.updatedAt,
  });
}