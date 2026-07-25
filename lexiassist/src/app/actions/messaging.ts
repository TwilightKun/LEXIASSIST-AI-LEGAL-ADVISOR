"use server";

import { prisma } from "@/lib/prisma";
import { pusher } from "@/lib/pusher/server";
import { requireCaseAccess } from "@/lib/auth-helpers";

export async function getDirectMessages(caseBriefId: string) {
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) return { success: false, error: auth.message };

  try {
    const messages = await prisma.directMessage.findMany({
      where: { caseBriefId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, role: true }
        }
      }
    });
    return { success: true, messages };
  } catch (error) {
    console.error("[DB ERROR] Failed to fetch messages:", error);
    return { success: false, error: "Failed to load chat history." };
  }
}

export async function sendDirectMessage(caseBriefId: string, content: string) {
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) return { success: false, error: auth.message };
  const senderId = auth.session.user.id;

  try {
    const message = await prisma.directMessage.create({
      data: {
        content,
        caseBriefId,
        senderId,
      },
      include: {
        sender: {
          select: { id: true, name: true, role: true }
        }
      }
    });

    await pusher.trigger(`chat-${caseBriefId}`, 'new-message', message);

    return { success: true, message };
  } catch (error) {
    console.error("[DB ERROR] Failed to send message:", error);
    return { success: false, error: "Failed to transmit message." };
  }
}