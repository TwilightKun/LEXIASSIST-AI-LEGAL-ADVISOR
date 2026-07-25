// src/lib/limits.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MAX_OPEN_CASES_PER_CLIENT = 25;

export async function enforceOpenCaseLimit(clientId: string): Promise<NextResponse | null> {
  const openCount = await prisma.caseBrief.count({
    where: { clientId, status: { not: "RESOLVED" } },
  });

  if (openCount >= MAX_OPEN_CASES_PER_CLIENT) {
    return NextResponse.json(
      {
        error: `You have ${openCount} open cases, which is the current limit. Resolve or close an existing case before starting a new one.`,
      },
      { status: 429 }
    );
  }

  return null;
}