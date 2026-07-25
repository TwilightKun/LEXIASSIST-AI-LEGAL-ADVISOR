"use server";

import { prisma } from "@/lib/prisma";
import { requireCaseAccess } from "@/lib/auth-helpers";

export async function getCaseData(caseBriefId: string) {
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) return { success: false, error: auth.message };

  try {
    const caseData = await prisma.caseBrief.findUnique({
      where: { id: caseBriefId },
      include: { documents: true },
    });

    if (!caseData) return { success: false, error: "Case not found." };
    return { success: true, data: caseData };
  } catch (error) {
    return { success: false, error: "Failed to fetch case data." };
  }
}