// src/app/dashboard/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ClientDashboard from "@/app/dashboard/ClientDashboard";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/");
  }

  const userId = (session.user as any).id;
  const userRole = (session.user as any).role;

  // Render the Lawyer specific view if they are a lawyer
  if (userRole === "LAWYER") {
    return (
      <div className="p-6 text-white font-mono">
        Lawyer Dashboard View
      </div>
    );
  }

  // 2. If Client, fetch cases and return strictly the ClientDashboard
  const existingCases = await prisma.caseBrief.findMany({
    where: { clientId: userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, status: true, createdAt: true },
  });

  return <ClientDashboard initialCases={existingCases} />;
}