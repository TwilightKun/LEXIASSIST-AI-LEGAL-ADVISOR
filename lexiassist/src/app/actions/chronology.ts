"use server";

import { prisma } from "@/lib/prisma";
import { requireCaseAccess } from "@/lib/auth-helpers";

export async function getCaseChronology(caseBriefId: string) {
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) return { success: false, error: auth.message };

  try {
    const caseBrief = await prisma.caseBrief.findUnique({
      where: { id: caseBriefId },
      select: { aiTimeline: true }
    });

    if (!caseBrief) {
      return { success: false, error: "Case matrix not found." };
    }

    return { success: true, timeline: caseBrief.aiTimeline };
  } catch (error) {
    console.error("Failed to fetch chronology:", error);
    return { success: false, error: "Database mapping failed." };
  }
}