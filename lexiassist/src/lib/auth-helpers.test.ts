// src/lib/auth-helpers.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ---------------------------------------------------------------

const mockGetServerSession = vi.fn();
vi.mock("next-auth", () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));

vi.mock("@/lib/auth.config", () => ({ authOptions: {} }));

const mockCaseBriefFindUnique = vi.fn();
const mockAgentSessionFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    caseBrief: { findUnique: (...args: any[]) => mockCaseBriefFindUnique(...args) },
    agentSession: { findUnique: (...args: any[]) => mockAgentSessionFindUnique(...args) },
  },
}));

// Default the rate limiter to "always allowed" so it doesn't fail our boundary tests
const mockLimit = vi.fn();
vi.mock("@/lib/rate-limit", () => ({
  generalApiLimiter: { limit: (...args: any[]) => mockLimit(...args) },
}));

import {
  requireUser,
  requireRole,
  requireCaseAccess,
  requireSessionAccess,
  requireAssignedLawyerOrAdmin,
} from "./auth-helpers";

// ---- Fixtures --------------------------------------------------------------

const CLIENT_A = { id: "client-a-id", role: "CLIENT" };
const CLIENT_B = { id: "client-b-id", role: "CLIENT" }; 
const LAWYER_ASSIGNED = { id: "lawyer-user-id", role: "LAWYER" };
const LAWYER_OTHER = { id: "other-lawyer-user-id", role: "LAWYER" };
const ADMIN = { id: "admin-id", role: "ADMIN" };

function sessionFor(user: { id: string; role: string } | null) {
  return user ? { user } : null;
}

const CASE_ID = "case-123";
const CASE_OWNED_BY_A = {
  clientId: CLIENT_A.id,
  lawyer: { userId: LAWYER_ASSIGNED.id },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, reset: Date.now() + 60000 });
});

// ---- requireUser ------------------------------------------------------------

describe("requireUser", () => {
  it("rejects with 401 when there is no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const result = await requireUser();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("accepts a valid session", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_A));
    const result = await requireUser();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.user.id).toBe(CLIENT_A.id);
  });

  it("rejects with 429 when the general rate limit is exceeded", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_A));
    mockLimit.mockResolvedValue({ success: false, limit: 60, remaining: 0, reset: Date.now() + 5000 });
    const result = await requireUser();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(429);
  });
});

// ---- requireRole ------------------------------------------------------------

describe("requireRole", () => {
  it("rejects a CLIENT trying to access a LAWYER-only action with 403", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_A));
    const result = await requireRole("LAWYER", "ADMIN");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("accepts a LAWYER for a LAWYER-gated action", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(LAWYER_ASSIGNED));
    const result = await requireRole("LAWYER", "ADMIN");
    expect(result.ok).toBe(true);
  });

  it("accepts an ADMIN wherever ADMIN is listed", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(ADMIN));
    const result = await requireRole("LAWYER", "ADMIN");
    expect(result.ok).toBe(true);
  });
});

// ---- requireCaseAccess -------------------------------------------------------

describe("requireCaseAccess", () => {
  it("allows the case's owning client", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_A));
    mockCaseBriefFindUnique.mockResolvedValue(CASE_OWNED_BY_A);
    const result = await requireCaseAccess(CASE_ID);
    expect(result.ok).toBe(true);
  });

  it("allows the case's assigned lawyer", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(LAWYER_ASSIGNED));
    mockCaseBriefFindUnique.mockResolvedValue(CASE_OWNED_BY_A);
    const result = await requireCaseAccess(CASE_ID);
    expect(result.ok).toBe(true);
  });

  it("REJECTS an unrelated client (IDOR protection)", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_B));
    mockCaseBriefFindUnique.mockResolvedValue(CASE_OWNED_BY_A);
    const result = await requireCaseAccess(CASE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("REJECTS an unrelated (non-assigned) lawyer", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(LAWYER_OTHER));
    mockCaseBriefFindUnique.mockResolvedValue(CASE_OWNED_BY_A);
    const result = await requireCaseAccess(CASE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("allows ADMIN unconditionally, without even querying the case", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(ADMIN));
    const result = await requireCaseAccess(CASE_ID);
    expect(result.ok).toBe(true);
    expect(mockCaseBriefFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for a nonexistent case", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_A));
    mockCaseBriefFindUnique.mockResolvedValue(null);
    const result = await requireCaseAccess("does-not-exist");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });

  it("rejects unauthenticated callers with 401 before ever touching the DB", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const result = await requireCaseAccess(CASE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
    expect(mockCaseBriefFindUnique).not.toHaveBeenCalled();
  });
});

// ---- requireSessionAccess -----------------------------------------------------

describe("requireSessionAccess", () => {
  const SESSION_ID = "session-abc";

  it("allows the session's direct clientId owner", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_A));
    mockAgentSessionFindUnique.mockResolvedValue({ clientId: CLIENT_A.id, caseBrief: null });
    const result = await requireSessionAccess(SESSION_ID);
    expect(result.ok).toBe(true);
  });

  it("allows access via the linked case's owner even if clientId differs", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_A));
    mockAgentSessionFindUnique.mockResolvedValue({
      clientId: "some-other-id",
      caseBrief: { clientId: CLIENT_A.id, lawyer: null },
    });
    const result = await requireSessionAccess(SESSION_ID);
    expect(result.ok).toBe(true);
  });

  it("allows the linked case's assigned lawyer", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(LAWYER_ASSIGNED));
    mockAgentSessionFindUnique.mockResolvedValue({
      clientId: CLIENT_A.id,
      caseBrief: { clientId: CLIENT_A.id, lawyer: { userId: LAWYER_ASSIGNED.id } },
    });
    const result = await requireSessionAccess(SESSION_ID);
    expect(result.ok).toBe(true);
  });

  it("REJECTS an unrelated client", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_B));
    mockAgentSessionFindUnique.mockResolvedValue({
      clientId: CLIENT_A.id,
      caseBrief: { clientId: CLIENT_A.id, lawyer: null },
    });
    const result = await requireSessionAccess(SESSION_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("returns 404 for a nonexistent session", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_A));
    mockAgentSessionFindUnique.mockResolvedValue(null);
    const result = await requireSessionAccess("nonexistent");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });
});

// ---- requireAssignedLawyerOrAdmin ----------------------------------------------

describe("requireAssignedLawyerOrAdmin", () => {
  it("allows the assigned lawyer", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(LAWYER_ASSIGNED));
    mockCaseBriefFindUnique.mockResolvedValue({ lawyer: { userId: LAWYER_ASSIGNED.id } });
    const result = await requireAssignedLawyerOrAdmin(CASE_ID);
    expect(result.ok).toBe(true);
  });

  it("REJECTS a lawyer who isn't assigned to this specific case", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(LAWYER_OTHER));
    mockCaseBriefFindUnique.mockResolvedValue({ lawyer: { userId: LAWYER_ASSIGNED.id } });
    const result = await requireAssignedLawyerOrAdmin(CASE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("REJECTS the case's own client", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(CLIENT_A));
    const result = await requireAssignedLawyerOrAdmin(CASE_ID);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
    expect(mockCaseBriefFindUnique).not.toHaveBeenCalled();
  });

  it("allows ADMIN unconditionally", async () => {
    mockGetServerSession.mockResolvedValue(sessionFor(ADMIN));
    const result = await requireAssignedLawyerOrAdmin(CASE_ID);
    expect(result.ok).toBe(true);
    expect(mockCaseBriefFindUnique).not.toHaveBeenCalled();
  });
});