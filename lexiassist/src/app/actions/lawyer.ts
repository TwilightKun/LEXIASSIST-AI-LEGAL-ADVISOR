// src/app/actions/lawyer.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, requireRole, requireCaseAccess, requireAssignedLawyerOrAdmin } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { pusher } from "@/lib/pusher/server";
import { JURISDICTIONS } from "@/lib/constants/jurisdictions";
import { LEGAL_DOMAINS } from "@/lib/schemas/tools/legal-schemas";

// ==========================================
// 1. LAWYER ONBOARDING
// ==========================================
export async function onboardLawyer(formData: {
  specialization: string[];
  jurisdiction: string;
  experienceYrs: number;
}) {
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.message };

  const userId = auth.session.user.id;

  // Validate against strict Enums to ensure matches can occur
  if (!JURISDICTIONS.includes(formData.jurisdiction as any)) {
    return {
      success: false,
      error: `"${formData.jurisdiction}" is not a recognized jurisdiction. Please select one from the list.`,
    };
  }

  const invalidDomains = formData.specialization.filter(
    (s) => !LEGAL_DOMAINS.includes(s as any)
  );
  if (invalidDomains.length > 0) {
    return {
      success: false,
      error: `Unrecognized specialization(s): ${invalidDomains.join(", ")}. Please select from the provided list.`,
    };
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { role: "LAWYER" },
      }),
      prisma.lawyerProfile.create({
        data: {
          userId,
          specialization: formData.specialization,
          jurisdiction: formData.jurisdiction,
          experienceYrs: formData.experienceYrs,
          isAvailable: true,
        },
      }),
    ]);

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Critical onboarding transaction failure:", error);
    return {
      success: false,
      error:
        error.code === "P2002"
          ? "A professional lawyer profile already exists for this account record."
          : "Failed to map operational profile onto the orchestration layer.",
    };
  }
}

// ==========================================
// 2. CASE ASSIGNMENT
// ==========================================
export async function assignLawyerToCase(caseBriefId: string, lawyerId: string) {
  if (!caseBriefId || !lawyerId) {
    return { success: false, error: "Missing case assignment parameters." };
  }

  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) return { success: false, error: auth.message };

  try {
    const lawyer = await prisma.lawyerProfile.findUnique({
      where: { id: lawyerId },
      select: { id: true, isAvailable: true },
    });

    if (!lawyer) {
      return { success: false, error: "Selected attorney profile could not be found." };
    }

    if (!lawyer.isAvailable) {
      return { success: false, error: "This attorney is no longer accepting new cases. Please select another." };
    }

    await prisma.caseBrief.update({
      where: { id: caseBriefId },
      data: {
        lawyerId,
        status: "MATCHED",
      },
    });

    await pusher.trigger(`case-${caseBriefId}`, "status-update", {
      status: "MATCHED",
    });
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to assign lawyer:", error);
    return { success: false, error: "Database mapping failed." };
  }
}

// ==========================================
// 3. LAWYER DASHBOARD DATA
// ==========================================
export async function getLawyerDashboardData() {
  const auth = await requireRole("LAWYER", "ADMIN");
  if (!auth.ok) return { success: false, error: auth.message };

  const userId = auth.session.user.id;

  try {
    const cases = await prisma.caseBrief.findMany({
      where: {
        lawyer: { userId },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        rawDescription: true,
        updatedAt: true,
        client: {
          select: { name: true, email: true },
        },
      },
    });

    return { success: true, cases };
  } catch (error) {
    console.error("Failed to fetch lawyer cases:", error);
    return { success: false, error: "Failed to load case matrix." };
  }
}

// ==========================================
// 4. ACCEPT CASE ACTION
// ==========================================
export async function acceptCase(caseId: string) {
  if (!caseId) return { success: false, error: "Case ID required." };

  const roleAuth = await requireRole("LAWYER");
  if (!roleAuth.ok) return { success: false, error: roleAuth.message };

  // STRICT GUARD: Must be assigned to this specific case
  const accessAuth = await requireAssignedLawyerOrAdmin(caseId);
  if (!accessAuth.ok) return { success: false, error: accessAuth.message };

  try {
    await prisma.caseBrief.update({
      where: { id: caseId },
      data: { status: "REVIEW" },
    });

    await pusher.trigger(`case-${caseId}`, "status-update", {
      status: "REVIEW",
    });
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to accept case:", error);
    return { success: false, error: "Database mapping failed." };
  }
}

// ==========================================
// 5. RESOLVE CASE ACTION
// ==========================================
export async function resolveCase(caseBriefId: string) {
  if (!caseBriefId) return { success: false, error: "Case Brief ID required." };

  const roleAuth = await requireRole("LAWYER", "ADMIN");
  if (!roleAuth.ok) return { success: false, error: roleAuth.message };

  // STRICT GUARD: Must be assigned to this specific case
  const accessAuth = await requireAssignedLawyerOrAdmin(caseBriefId);
  if (!accessAuth.ok) return { success: false, error: accessAuth.message };

  try {
    const updatedCase = await prisma.caseBrief.update({
      where: { id: caseBriefId },
      data: { status: "RESOLVED" },
    });

    await pusher.trigger(`case-${caseBriefId}`, "status-update", {
      status: "RESOLVED",
    });

    return { success: true, caseBrief: updatedCase };
  } catch (error) {
    console.error("[DB ERROR] Failed to resolve case:", error);
    return {
      success: false,
      error: "Failed to update case status in database.",
    };
  }
}