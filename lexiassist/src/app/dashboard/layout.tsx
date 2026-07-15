// src/app/dashboard/layout.tsx
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

export default async function DashboardLayout({
  children,
  caselist,
  analytics,
}: {
  children: ReactNode;
  caselist: ReactNode;
  analytics: ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const userRole = (session?.user as any)?.role;

  // 1. CLIENT VIEW: Return a clean slate. 
  // The ClientDashboard SPA component handles its own full-screen layout.
  if (userRole !== "LAWYER") {
    return <>{children}</>;
  }

  // 2. LAWYER VIEW: Return the Attorney Portal with Parallel Routes
  return (
    <div className="flex min-h-screen bg-[#08080a] text-zinc-200">
      {/* Sidebar (Placeholder for now) */}
      <aside className="w-64 border-r border-zinc-800/60 bg-[#0c0c0e] p-6 hidden md:block">
        <h2 className="text-lg font-light tracking-[0.2em] text-zinc-100 uppercase">LEXIASSIST</h2>
        <p className="mt-1 text-[10px] tracking-widest text-emerald-500 uppercase font-mono">Attorney Portal</p>
      </aside>

      {/* Main Dashboard Area */}
      <main className="flex-1 p-6 lg:p-10 overflow-y-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-medium tracking-wide">Active Triage Overview</h1>
          <p className="text-sm text-zinc-500 mt-1">Review AI-generated Pre-Briefs and case analytics.</p>
        </header>

        {children}

        {/* Parallel Route Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
          <div className="xl:col-span-2">
            {caselist}
          </div>
          <div className="xl:col-span-1">
            {analytics}
          </div>
        </div>
      </main>
    </div>
  );
}