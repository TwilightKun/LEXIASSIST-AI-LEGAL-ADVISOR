"use server";

import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { requireCaseAccess } from "@/lib/auth-helpers";

export async function getOrInitializeConsultation(caseBriefId: string) {
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) return { success: false, error: auth.message };

  try {
    let consultation = await prisma.consultation.findFirst({
      where: { caseBriefId, isCompleted: false },
    });

    if (!consultation) {
      const secureRoomHash = `room-${randomBytes(8).toString("hex")}`;

      consultation = await prisma.consultation.create({
        data: {
          caseBriefId,
          webrtcRoomId: secureRoomHash,
          scheduledAt: new Date(),
          isCompleted: false,
        },
      });
    }

    return { success: true, consultation };
  } catch (error) {
    console.error("[DB ERROR] Failed to orchestrate consultation room:", error);
    return { success: false, error: "Failed to initialize secure connection." };
  }
}

export async function markConsultationComplete(consultationId: string, caseBriefId: string) {
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) return { success: false, error: auth.message };

  try {
    // Verify the consultation actually belongs to this case before touching it
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      select: { caseBriefId: true },
    });

    if (!consultation || consultation.caseBriefId !== caseBriefId) {
      return { success: false, error: "Consultation does not belong to this case." };
    }

    await prisma.$transaction([
      prisma.consultation.update({
        where: { id: consultationId },
        data: { isCompleted: true },
      }),
      prisma.caseBrief.update({
        where: { id: caseBriefId },
        data: { status: "RESOLVED" }
      })
    ]);
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to close consultation." };
  }
}