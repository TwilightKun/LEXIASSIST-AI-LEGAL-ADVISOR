// src/app/actions/document.ts
"use server";

import { Client } from '@upstash/qstash';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { headers } from "next/headers";

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });

// 1. DISPATCH DOCUMENT TO AI ENGINE
export async function dispatchPdfToAgent(fileUrl: string, caseBriefId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Unauthorized session context." };
    }
    
    const clientId = (session.user as any).id;
    let validCaseBriefId = caseBriefId;

    // Fallback for testing environments
    if (validCaseBriefId === "test-case-id") {
      const activeBrief = await prisma.caseBrief.findFirst();
      if (activeBrief) {
        validCaseBriefId = activeBrief.id;
      } else {
        return { 
          success: false, 
          error: "Database constraint error: You must create at least one Case Brief first!" 
        };
      }
    }

    // 1. Save the document record as "Pending" immediately
    const newDoc = await prisma.document.create({
      data: {
        fileUrl: fileUrl,
        caseBriefId: validCaseBriefId,
        extractedText: "Pending extraction...", 
      },
    });
    console.log("Document successfully saved as pending to DB:", newDoc.id);

    // 2. Create the AgentSession (Required by backend engine)
    const agentSession = await prisma.agentSession.create({
      data: {
        clientId: clientId, 
        caseBriefId: validCaseBriefId,
        status: "PROCESSING", 
        messages: [
          {
            role: "user",
            // The exact format Regex engine is looking for
            content: `Please analyze the attached document for triage. [Attached File URL: ${fileUrl}]`
          }
        ]
      }
    });

    // 3. Resolve the current application URL and fire QStash
    const headersList = await headers(); 
    const host = headersList.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

    await qstashClient.publishJSON({
      url: `${appUrl}/api/agent/parse-pdf`,
      body: {
        sessionId: agentSession.id,
        clientId: clientId,
        currentStep: 0,
        metadata: {},
        messages: agentSession.messages,
      },
    });

    return { success: true, sessionId: agentSession.id, documentId: newDoc.id };
  } catch (error: any) {
    console.error("Critical Dispatch Failure:", error);
    return { success: false, error: "Failed to process document and alert AI engine." };
  }
}

// 2. FETCH DOCUMENT FOR REDLINE VIEWER
export async function getCaseDocument(caseBriefId: string) {
  try {
    const doc = await prisma.document.findFirst({
      where: { caseBriefId },
      orderBy: { createdAt: 'desc' }, // Get the most recently uploaded document
    });
    
    return { success: true, document: doc };
  } catch (error) {
    console.error("Failed to fetch document:", error);
    return { success: false, error: "Failed to load document data from the database." };
  }
}