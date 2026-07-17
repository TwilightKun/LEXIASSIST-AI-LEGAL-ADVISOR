//src/app/actions/chat.ts
"use server";

import { prisma } from "@/lib/prisma";

// Fetches the most recent session history for a specific case brief
export async function getChatHistory(caseBriefId: string) {
  try {
    const session = await prisma.agentSession.findFirst({
      where: { caseBriefId },
      orderBy: { createdAt: "desc" },
    });

    if (!session) return { success: true, sessionId: null, messages: [] };

    return { 
      success: true, 
      sessionId: session.id, 
      messages: session.messages || [] 
    };
  } catch (error) {
    console.error("Failed to fetch chat history:", error);
    return { success: false, error: "Failed to load history." };
  }
}