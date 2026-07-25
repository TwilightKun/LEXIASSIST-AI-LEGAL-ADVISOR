// src/app/actions/document.ts
"use server";

import { prisma } from "@/lib/prisma";
import { requireCaseAccess } from "@/lib/auth-helpers";

// ==========================================
// 1. UPLOAD & SAVE DOCUMENT
// ==========================================
export async function saveDocumentRecord(fileUrl: string, caseBriefId: string) {
  if (!fileUrl || !caseBriefId) {
    return { success: false, error: "Missing required document parameters." };
  }

  // Session & Ownership Check: Ensures user owns or is assigned to this case
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) {
    return { success: false, error: auth.message };
  }

  try {
    const newDoc = await prisma.document.create({
      data: {
        fileUrl,
        caseBriefId,
        extractedText: "Pending extraction...",
      },
    });

    return { success: true, document: newDoc };
  } catch (error) {
    console.error("[DB ERROR] Failed to save document:", error);
    return { success: false, error: "Failed to persist document record in database." };
  }
}

// ==========================================
// 2. FETCH DOCUMENT FOR REDLINE VIEWER
// ==========================================
export async function getCaseDocument(caseBriefId: string) {
  if (!caseBriefId) {
    return { success: false, error: "Case Brief ID required." };
  }

  // Session & Ownership Check: Ensures user owns or is assigned to this case
  const auth = await requireCaseAccess(caseBriefId);
  if (!auth.ok) {
    return { success: false, error: auth.message };
  }

  try {
    const document = await prisma.document.findFirst({
      where: { caseBriefId },
      orderBy: { createdAt: "desc" },
    });

    if (!document) {
      return { success: false, error: "No documents mapped to this specific case." };
    }

    return { success: true, document };
  } catch (error) {
    console.error("[DB ERROR] Failed to fetch document:", error);
    return { success: false, error: "Database retrieval failed." };
  }
}