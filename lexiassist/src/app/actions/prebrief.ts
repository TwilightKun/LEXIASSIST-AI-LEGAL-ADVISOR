"use server";

import { prisma } from "@/lib/prisma";

export async function getCasePreBrief(caseBriefId: string) {
  try {
    const caseBrief = await prisma.caseBrief.findUnique({
      where: { id: caseBriefId },
      select: { 
        aiRiskAnalysis: true, 
        estimatedValue: true,
        rawDescription: true // Fallback just in case
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