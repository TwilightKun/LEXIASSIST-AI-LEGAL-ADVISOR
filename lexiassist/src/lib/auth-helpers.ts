// src/lib/auth-helpers.ts
import { getServerSession, type Session } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { Ratelimit } from "@upstash/ratelimit";
import { generalApiLimiter } from "@/lib/rate-limit";

type AuthOk = { ok: true; session: Session & { user: { id: string; role: string } } };
type AuthFail = { ok: false; response: NextResponse; message: string };

function rateLimitResponse(result: { limit: number; remaining: number; reset: number }) {
  const retryAfterSec = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

/** Verifies authenticated user AND applies baseline rate limiting (60 req/min). */
export async function requireUser(): Promise<AuthOk | AuthFail> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      ok: false,
      message: "Not authenticated.",
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const limitResult = await generalApiLimiter.limit(session.user.id);
  if (!limitResult.success) {
    return {
      ok: false,
      message: "Rate limited.",
      response: rateLimitResponse(limitResult),
    };
  }

  return { ok: true, session: session as AuthOk["session"] };
}

/** Helper for routes requiring stricter rate limits on top of requireUser(). */
export async function requireRateLimited(
  limiter: Ratelimit,
  identifier: string
): Promise<NextResponse | null> {
  const result = await limiter.limit(identifier);
  if (!result.success) return rateLimitResponse(result);
  return null;
}

/** Verifies user holds required role(s). */
export async function requireRole(
  ...roles: Array<"CLIENT" | "LAWYER" | "ADMIN">
): Promise<AuthOk | AuthFail> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  if (!roles.includes(auth.session.user.role as any)) {
    return {
      ok: false,
      message: "Insufficient role.",
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return auth;
}

/** Verifies user owns or is assigned to a CaseBrief. */
export async function requireCaseAccess(
  caseBriefId: string
): Promise<AuthOk | AuthFail> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const { id: userId, role } = auth.session.user;

  if (role === "ADMIN") return auth;

  const brief = await prisma.caseBrief.findUnique({
    where: { id: caseBriefId },
    select: {
      clientId: true,
      lawyer: { select: { userId: true } },
    },
  });

  if (!brief) {
    return {
      ok: false,
      message: "Case not found.",
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const isOwner = brief.clientId === userId;
  const isAssignedLawyer = brief.lawyer?.userId === userId;

  if (!isOwner && !isAssignedLawyer) {
    return {
      ok: false,
      message: "You do not have access to this case.",
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return auth;
}

/** Verifies assigned lawyer or admin. */
export async function requireAssignedLawyerOrAdmin(
  caseBriefId: string
): Promise<AuthOk | AuthFail> {
  const auth = await requireRole("LAWYER", "ADMIN");
  if (!auth.ok) return auth;
  if (auth.session.user.role === "ADMIN") return auth;

  const brief = await prisma.caseBrief.findUnique({
    where: { id: caseBriefId },
    select: { lawyer: { select: { userId: true } } },
  });

  if (!brief) {
    return {
      ok: false,
      message: "Case not found.",
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  if (brief.lawyer?.userId !== auth.session.user.id) {
    return {
      ok: false,
      message: "You are not the assigned lawyer for this case.",
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return auth;
}

/** Verifies access to an AgentSession. */
export async function requireSessionAccess(
  agentSessionId: string
): Promise<AuthOk | AuthFail> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const { id: userId, role } = auth.session.user;
  if (role === "ADMIN") return auth;

  const agentSession = await prisma.agentSession.findUnique({
    where: { id: agentSessionId },
    select: {
      clientId: true,
      caseBrief: { select: { clientId: true, lawyer: { select: { userId: true } } } },
    },
  });

  if (!agentSession) {
    return {
      ok: false,
      message: "Session not found.",
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }

  const isDirectOwner = agentSession.clientId === userId;
  const isCaseOwner = agentSession.caseBrief?.clientId === userId;
  const isAssignedLawyer = agentSession.caseBrief?.lawyer?.userId === userId;

  if (!isDirectOwner && !isCaseOwner && !isAssignedLawyer) {
    return {
      ok: false,
      message: "You do not have access to this session.",
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return auth;
}