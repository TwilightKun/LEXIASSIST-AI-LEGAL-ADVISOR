// src/app/dashboard/onboarding/page.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { onboardLawyer } from "@/app/actions/lawyer";
import { JURISDICTIONS } from "@/lib/constants/jurisdictions";
import { LEGAL_DOMAINS } from "@/lib/schemas/tools/legal-schemas";

export default function LawyerOnboardingPage() {
  const [jurisdiction, setJurisdiction] = useState<string>("");
  const [experienceYrs, setExperienceYrs] = useState<number>(2);
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const toggleSpecialization = (domain: string) => {
    setSpecializations((prev) =>
      prev.includes(domain) ? prev.filter((s) => s !== domain) : [...prev, domain]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (specializations.length === 0) {
      setError("Please select at least one focus specialization area.");
      return;
    }
    if (!jurisdiction) {
      setError("Please select a jurisdiction.");
      return;
    }

    startTransition(async () => {
      const result = await onboardLawyer({
        specialization: specializations,
        jurisdiction,
        experienceYrs: Number(experienceYrs),
      });

      if (result.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error || "An unknown routing mutation error occurred.");
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-200 flex items-center justify-center p-6 selection:bg-zinc-800">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800/60 bg-[#0c0c0e]/80 p-8 shadow-2xl backdrop-blur-xl space-y-6">

        <div>
          <h2 className="text-xl font-light tracking-wide text-white">Attorney Portal Onboarding</h2>
          <p className="text-xs text-zinc-500 font-mono mt-1">// Establish credentials matrix mapping for client matching.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-4 text-xs font-mono text-rose-400">
            [System Error]: {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-sm">
          {/* DATA-INTEGRITY FIX: Jurisdiction Picker constrained to exact ENUM list */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">Geographic Jurisdiction</label>
            <select
              required
              disabled={isPending}
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="w-full rounded-xl border border-zinc-800/60 bg-zinc-900/20 px-4 py-3 text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors appearance-none"
            >
              <option value="" disabled>Select a jurisdiction...</option>
              {JURISDICTIONS.map((j) => (
                <option key={j} value={j} className="bg-[#0c0c0e]">{j}</option>
              ))}
            </select>
          </div>

          {/* Years Experience Entry */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">Years of Practice Experience</label>
            <input
              type="number"
              min={0}
              max={80}
              required
              disabled={isPending}
              value={experienceYrs}
              onChange={(e) => setExperienceYrs(Number(e.target.value))}
              className="w-full rounded-xl border border-zinc-800/60 bg-zinc-900/20 px-4 py-3 text-zinc-200 focus:outline-none focus:border-zinc-700 transition-colors font-mono"
            />
          </div>

          {/* DATA-INTEGRITY FIX: Specialization Picker multi-select against exact LEGAL_DOMAINS */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">Areas of Legal Specialization</label>
            <p className="text-[10px] text-zinc-600 font-mono">Select every area you practice in</p>

            <div className="flex flex-wrap gap-2 pt-1">
              {LEGAL_DOMAINS.map((domain) => {
                const isSelected = specializations.includes(domain);
                return (
                  <button
                    key={domain}
                    type="button"
                    disabled={isPending}
                    onClick={() => toggleSpecialization(domain)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors ${
                      isSelected
                        ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-300"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    }`}
                  >
                    {domain}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full mt-4 flex items-center justify-center rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 font-medium py-3 px-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-xs uppercase tracking-widest"
          >
            {isPending ? (
              <span className="flex items-center gap-2 font-mono lowercase tracking-normal text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                binding credentials onto layer...
              </span>
            ) : (
              "Initialize Lawyer Account"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}