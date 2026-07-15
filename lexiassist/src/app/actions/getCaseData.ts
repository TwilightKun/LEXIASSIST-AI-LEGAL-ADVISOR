// src/app/actions/getCaseData.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

export async function getCaseDetails(caseId: string) {
  try {
    // Enforce Session Validation
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Unauthorized access blocked." };
    }

    // Single relational database query
    const caseBrief = await prisma.caseBrief.findUnique({
      where: { id: caseId },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!caseBrief) {
      return { success: false, error: "Case not found in the database." };
    }

    const latestDocument = caseBrief.documents[0] || null;

    return {
      success: true,
      data: {
        aiTimeline: (caseBrief.aiTimeline as any[]) || [],
        redlines: (latestDocument?.redlines as any[]) || [],
        
        fileUrl: latestDocument?.fileUrl || "",
        documentName: latestDocument?.fileUrl ? latestDocument.fileUrl.split("/").pop() || "Document.pdf" : "No Document Attached",
      },
    };
  } catch (error: any) {
    console.error("[GET_CASE_DATA_ERROR]:", error);
    return { success: false, error: "Failed to fetch case architecture." };
  }
}