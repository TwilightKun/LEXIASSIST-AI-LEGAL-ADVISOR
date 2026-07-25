// src/lib/tools/actions/case.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { enforceOpenCaseLimit } from "@/lib/limits";

export async function createNewCase(title: string = "New Legal Inquiry") {
  // Gate check: Apply shared auth, which automatically applies the general API rate limit
  const auth = await requireUser();
  if (!auth.ok) return { success: false, error: auth.message };

  const userId = auth.session.user.id;

  // Gate check: Prevent database spam by enforcing the active case limit
  const overLimit = await enforceOpenCaseLimit(userId);
  if (overLimit) {
    const body = await overLimit.json();
    return { success: false, error: body.error };
  }

  try {
    const newCase = await prisma.caseBrief.create({
      data: {
        title: title,
        status: "TRIAGE",
        rawDescription: "", // Satisfies the mandatory database field constraint
        client: {
          connect: { id: userId } // Establishes the safe foreign key relation mapping
        }
      },
    });

    // Purge the cache states for the dashboard views
    revalidatePath("/dashboard");

    return { success: true, caseId: newCase.id, caseBrief: newCase };
  } catch (error: any) {
    console.error("Critical case initialization failure:", error);
    return { success: false, error: "Failed to initialize case matrix." };
  }
}