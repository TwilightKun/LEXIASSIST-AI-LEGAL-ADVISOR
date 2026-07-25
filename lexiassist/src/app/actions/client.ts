"use server";

import { prisma } from "@/lib/prisma";
import { requireCaseAccess } from "@/lib/auth-helpers";

export async function getClientCaseDetails(caseId: string) {
  const auth = await requireCaseAccess(caseId);
  if (!auth.ok) return { success: false, error: auth.message };

  try {
    const caseBrief = await prisma.caseBrief.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        rawDescription: true,
        lawyer: {
          select: {
            jurisdiction: true,
            experienceYrs: true,
            user: {
              select: { name: true }
            }
          }
        }
      }
    });

    if (!caseBrief) {
      return { success: false, error: "Case matrix not found." };
    }

    return { success: true, caseBrief };
  } catch (error) {
    console.error("Failed to fetch client case details:", error);
    return { success: false, error: "Database mapping failed." };
  }
}