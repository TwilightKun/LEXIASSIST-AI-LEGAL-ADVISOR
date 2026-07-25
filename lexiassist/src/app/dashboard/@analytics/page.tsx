// src/app/dashboard/@analytics/page.tsx
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";

export default async function AnalyticsSlot() {
  // SECURITY FIX: Gate cross-tenant aggregate analytics to ADMIN
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (role !== "ADMIN") {
    return null;
  }

  // Run Prisma aggregations in parallel for maximum speed
  const [totalCases, triageCount, reviewCount, resolvedCount] = await Promise.all([
    prisma.caseBrief.count(),
    prisma.caseBrief.count({ where: { status: 'TRIAGE' } }),
    prisma.caseBrief.count({ where: { status: 'REVIEW' } }),
    prisma.caseBrief.count({ where: { status: 'RESOLVED' } }),
  ]);

  // Safe percentage calculation to avoid dividing by zero
  const getPercent = (count: number) => totalCases > 0 ? Math.round((count / totalCases) * 100) : 0;

  const metrics = [
    { label: "Urgent (Triage)", count: triageCount, percentage: getPercent(triageCount), color: "bg-rose-500", stroke: "#f43f5e" },
    { label: "Under Review", count: reviewCount, percentage: getPercent(reviewCount), color: "bg-amber-500", stroke: "#f59e0b" },
    { label: "Resolved", count: resolvedCount, percentage: getPercent(resolvedCount), color: "bg-emerald-500", stroke: "#10b981" },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-[#0c0c0e]/80 p-6 shadow-xl flex flex-col h-125 justify-between">
      <div>
        <h3 className="text-sm font-mono tracking-widest text-emerald-500/80 uppercase">Risk Distribution</h3>
        <p className="text-xs text-zinc-600 mt-0.5">Aggregated tactical analysis indicators</p>
      </div>

      {/* Modern Center Graph Matrix */}
      <div className="my-6 relative flex flex-col items-center justify-center py-4 bg-zinc-900/10 rounded-xl border border-zinc-800/30">
        <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#18181b" strokeWidth="2.5" />
          {/* Dynamic SVG Rings based on percentages */}
          {metrics.map((m, i) => {
             // Basic stack calculation for the dashed rings
             const offset = i === 0 ? 0 : i === 1 ? -(metrics[0].percentage) : -(metrics[0].percentage + metrics[1].percentage);
             if (m.percentage === 0) return null;
             
             return (
               <circle 
                 key={i} 
                 cx="18" cy="18" r="15.915" fill="none" 
                 stroke={m.stroke} strokeWidth="2.5" 
                 strokeDasharray={`${m.percentage} 100`} 
                 strokeDashoffset={offset} 
               />
             )
          })}
        </svg>
        <div className="absolute text-center">
          <span className="text-2xl font-light tracking-tight text-zinc-100">{totalCases}</span>
          <span className="text-[9px] font-mono text-zinc-500 block uppercase tracking-widest mt-0.5">Total Cases</span>
        </div>
      </div>

      {/* Metrics Stack */}
      <div className="space-y-4">
        {metrics.map((m, idx) => (
          <div key={idx} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${m.color}`} />
                {m.label}
              </span>
              <span className="font-mono text-zinc-500">{m.count} cases</span>
            </div>
            <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
              <div className={`h-full ${m.color} rounded-full`} style={{ width: `${m.percentage}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}