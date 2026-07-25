"use server";

import { prisma } from "@/lib/prisma";
import { requireCaseAccess } from "@/lib/auth-helpers";

export async function getCasePreBrief(caseBriefId: string) {
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) return { success: false, error: auth.message };

  try {
    const caseBrief = await prisma.caseBrief.findUnique({
      where: { id: caseBriefId },
      select: {
        aiRiskAnalysis: true,
        estimatedValue: true,
        rawDescription: true
      }
    });

    if (!caseBrief) {
      return { success: false, error: "Case matrix not found." };
    }

    return {
      success: true,
      aiRiskAnalysis: caseBrief.aiRiskAnalysis,
      estimatedValue: caseBrief.estimatedValue,
      rawDescription: caseBrief.rawDescription
    };
  } catch (error) {
    console.error("Failed to fetch pre-brief:", error);
    return { success: false, error: "Database mapping failed." };
  }
}