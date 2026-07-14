// src/app/dashboard/onboarding/page.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { onboardLawyer } from "@/app/actions/lawyer";

export default function LawyerOnboardingPage() {
  const [jurisdiction, setJurisdiction] = useState("");
  const [experienceYrs, setExperienceYrs] = useState<number>(2);
  const [specInput, setSpecInput] = useState("");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Add tag specialization array mapping
  const handleAddSpecialization = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && specInput.trim()) {
      e.preventDefault();
      if (!specializations.includes(specInput.trim())) {
        setSpecializations([...specializations, specInput.trim()]);
      }
      setSpecInput("");
    }
  };

  const removeSpecialization = (tag: string) => {
    setSpecializations(specializations.filter((s) => s !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (specializations.length === 0) {
      setError("Please add at least one focus specialization area.");
      return;
    }
    if (!jurisdiction.trim()) {
      setError("Jurisdiction geographical boundary region is required.");
      return;
    }

    startTransition(async () => {
      const result = await onboardLawyer({
        specialization: specializations,
        jurisdiction: jurisdiction.trim(),
        experienceYrs: Number(experienceYrs),
      });

      if (result.success) {
        // Snap to the verified dynamic slots view instantly
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
          {/* Jurisdiction Entry */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">Geographic Jurisdiction</label>
            <input
              type="text"
              required
              disabled={isPending}
              placeholder="e.g., California, Federal District Court"
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="w-full rounded-xl border border-zinc-800/60 bg-zinc-900/20 px-4 py-3 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
            />
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

          {/* Specialization Array Builder */}
          <div className="space-y-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-zinc-400">Areas of Legal Specialization</label>
            <p className="text-[10px] text-zinc-600 font-mono">Type focus (e.g., Corporate Law) and hit [Enter] to map tag</p>
            <input
              type="text"
              disabled={isPending}
              placeholder={specializations.length === 0 ? "e.g., IP Litigation, Family Law" : "Add more areas..."}
              value={specInput}
              onChange={(e) => setSpecInput(e.target.value)}
              onKeyDown={handleAddSpecialization}
              className="w-full rounded-xl border border-zinc-800/60 bg-zinc-900/20 px-4 py-3 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 transition-colors"
            />

            {/* Rendered Specialization Tags */}
            <div className="flex flex-wrap gap-2 pt-2">
              {specializations.map((tag, idx) => (
                <span 
                  key={idx} 
                  className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs text-zinc-300 font-mono"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeSpecialization(tag)}
                    className="text-zinc-500 hover:text-rose-400 transition-colors font-sans text-xs font-bold pl-1"
                  >
                    ×
                  </button>
                </span>
              ))}
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