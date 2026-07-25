"use server";

import { prisma } from "@/lib/prisma";
import { requireCaseAccess } from "@/lib/auth-helpers";

export async function getChatHistory(caseBriefId: string) {
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) return { success: false, error: auth.message };

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