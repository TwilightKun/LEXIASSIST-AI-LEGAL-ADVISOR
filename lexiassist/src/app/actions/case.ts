// src/app/actions/case.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { revalidatePath } from "next/cache";

export async function createNewCase() {
  // 1. Secure the route using NextAuth
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return { success: false, error: "Unauthorized session mapping." };
  }

  const clientId = (session.user as any).id;

  try {
    // 2. Generate a clean, professional title ID
    const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();

    // 3. Insert the new CaseBrief into PostgreSQL
    const newCase = await prisma.caseBrief.create({
      data: {
        clientId: clientId,
        title: `New Legal Inquiry (${shortId})`,
        status: "TRIAGE", // Safe default status
        rawDescription: "Pending client intake...",
      },
    });

    // 4. Purge the cache so the dashboard immediately updates
    revalidatePath("/dashboard");

    return {
      success: true,
      caseId: newCase.id,
      caseBrief: newCase,
    };
  } catch (error: any) {
    console.error("[CREATE_CASE_ERROR]:", error);
    return { 
      success: false, 
      error: "Failed to initialize a new case brief in the database." 
    };
  }
}