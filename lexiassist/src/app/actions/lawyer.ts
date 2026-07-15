// src/app/actions/lawyer.ts
"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { revalidatePath } from "next/cache";

// TASK 6: LAWYER ONBOARDING 
export async function onboardLawyer(formData: {
  specialization: string[];
  jurisdiction: string;
  experienceYrs: number;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !(session.user as any).id) {
    return { success: false, error: "Unauthorized session mapping." };
  }

  const userId = (session.user as any).id;

  try {
    // Run a sequential transaction to ensure database structural integrity
    await prisma.$transaction([
      // Upgrade the global user record role to LAWYER
      prisma.user.update({
        where: { id: userId },
        data: { role: "LAWYER" },
      }),
      // Populate the detailed LawyerProfile metadata structure
      prisma.lawyerProfile.create({
        data: {
          userId: userId,
          specialization: formData.specialization,
          jurisdiction: formData.jurisdiction,
          experienceYrs: formData.experienceYrs,
          isAvailable: true,
        },
      }),
    ]);

    // Force Next.js to purge cached states of the dashboard views
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Critical onboarding transaction failure:", error);
    return { 
      success: false, 
      error: error.code === "P2002" 
        ? "A professional lawyer profile already exists for this account record." 
        : "Failed to map operational profile onto the orchestration layer." 
    };
  }
}

// CASE ASSIGNMENT (LAWYER MATCHING)

export async function assignLawyerToCase(caseId: string, lawyerId: string) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // Update the CaseBrief with the selected lawyer and advance the status
    await prisma.caseBrief.update({
      where: { id: caseId },
      data: { 
        lawyerId: lawyerId,
        status: "MATCHED" 
      },
    });

    revalidatePath("/dashboard");
    
    return { success: true };
  } catch (error) {
    console.error("Failed to assign attorney:", error);
    return { success: false, error: "Database transaction failed." };
  }
}