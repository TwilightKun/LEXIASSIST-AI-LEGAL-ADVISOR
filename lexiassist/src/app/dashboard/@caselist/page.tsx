// src/app/dashboard/@caselist/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

export default async function CaseListSlot() {
  // SECURITY FIX: Gate previously unprotected cross-tenant data fetch to ADMIN
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (role !== "ADMIN") {
    return null;
  }

  const liveCases = await prisma.caseBrief.findMany({
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      aiRiskAnalysis: true,
      // SECURITY FIX: Scope client selection to prevent password hash leakage
      client: { select: { name: true, email: true } }, 
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-[#0c0c0e]/80 p-6 shadow-xl flex flex-col h-125">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-mono tracking-widest text-zinc-400 uppercase">Active Intakes</h3>
          <p className="text-xs text-zinc-600 mt-0.5">Real-time AI structure mapping pipeline</p>
        </div>
        <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-[10px] font-mono border border-zinc-800 text-zinc-400">
          {liveCases.length} PENDING
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
        {liveCases.length === 0 && (
          <div className="h-full flex items-center justify-center text-sm text-zinc-600 font-mono">
            No active cases found in database.
          </div>
        )}

        {liveCases.map((c) => {
          const clientName = c.client?.name || c.client?.email || "Anonymous Client";
          const riskScore = (c.aiRiskAnalysis as any)?.riskScore || 0;

          return (
            <Link
              href={`/case/${c.id}`}
              key={c.id}
              className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-zinc-800/50 bg-zinc-900/10 hover:bg-zinc-900/40 hover:border-zinc-700/80 transition-all cursor-pointer"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{clientName}</h4>
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                    c.status === "TRIAGE" ? "bg-rose-950/30 border-rose-900/40 text-rose-400 animate-pulse" :
                    c.status === "RESOLVED" ? "bg-emerald-950/30 border-emerald-900/40 text-emerald-400" :
                    "bg-amber-950/30 border-amber-900/40 text-amber-400"
                  }`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-mono max-w-62.5 truncate">
                  {c.title} • {new Date(c.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-6 mt-3 sm:mt-0 justify-between sm:justify-end border-t border-zinc-800/30 sm:border-0 pt-2 sm:pt-0">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider block">AI Risk Index</span>
                  <span className={`text-sm font-mono font-bold ${riskScore > 75 ? "text-rose-400" : riskScore > 50 ? "text-amber-400" : "text-emerald-400"}`}>
                    {riskScore > 0 ? `${riskScore}%` : 'N/A'}
                  </span>
                </div>
                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 group-hover:bg-zinc-100 group-hover:text-zinc-950 transition-all shadow-md">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}