// src/app/actions/chat.ts
"use server";

import { prisma } from "@/lib/prisma";

export async function getChatHistory(caseBriefId: string) {
  try {
    // Find the most recent session linked to this specific case
    const session = await prisma.agentSession.findFirst({
      where: { caseBriefId },
      orderBy: { createdAt: "desc" },
    });

    if (!session) {
      // If no session exists yet, return empty arrays to start fresh
      return { success: true, messages: [], sessionId: null };
    }

    return {
      success: true,
      messages: (session.messages as any[]) || [],
      sessionId: session.id,
    };
  } catch (error) {
    console.error("[GET_CHAT_HISTORY_ERROR]:", error);
    return { success: false, error: "Failed to load chat history." };
  }
}