// src/app/attorney/join/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Scale, ShieldCheck, Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { registerClient } from "@/app/actions/register"; // Reusing the base account creator
import Link from "next/link";

export default function AttorneyJoinPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // 1. Create the base database record
    const result = await registerClient({ name, email, password });

    if (result.success) {
      // 2. Log them in, but force the callback to the Onboarding Matrix
      await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        callbackUrl: "/dashboard/onboarding", // Bypasses the Client Dashboard entirely
      });
    } else {
      setError(result.error || "Failed to initialize application.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 flex items-center justify-center p-6 selection:bg-emerald-500/30">
      
      {/* Background Styling */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#111_0%,#050505_80%)]" />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/asfalt-dark.png')" }} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-250 bg-[#0c0c0e]/80 border border-zinc-800/60 rounded-3xl shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col md:flex-row relative z-10"
      >
        
        {/* Left Side: Branding / Value Prop */}
        <div className="md:w-5/12 bg-zinc-950 p-10 flex flex-col justify-between border-r border-zinc-800/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-20 -mt-20" />
          
          <div>
            <Link href="/" className="inline-flex items-center gap-2 text-xl font-light tracking-[0.2em] text-zinc-100 hover:text-white transition-colors">
              <span className="text-emerald-500">⚖️</span> LEXIASSIST
            </Link>
            <div className="mt-12 space-y-6 relative z-10">
              <h2 className="text-3xl font-thin tracking-wide leading-tight">Elite Legal<br/>Network.</h2>
              <p className="text-sm text-zinc-400 leading-relaxed font-sans">
                Join the exclusive matrix of verified attorneys. Automate your intake triage, review AI-generated redlines, and accept high-value mandates instantly.
              </p>
            </div>
          </div>

          <div className="mt-12 space-y-4">
            {["E2E Encrypted Video", "AI Document Pre-Briefs", "Verified Client Routing"].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-xs font-mono text-zinc-500 uppercase tracking-widest">
                <ShieldCheck className="w-4 h-4 text-emerald-500/70" /> {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Application Form */}
        <div className="md:w-7/12 p-10 sm:p-14">
          <div className="mb-8">
            <h3 className="text-xl font-medium tracking-wide text-zinc-100">Attorney Application</h3>
            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">// Step 1: Base Credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="bg-rose-950/20 border border-rose-900/40 text-rose-400 p-3.5 rounded-xl text-xs font-mono flex items-center gap-2.5 overflow-hidden">
                  <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-1">Full Name (As Registered with Bar)</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} className="w-full bg-[#08080a] border border-zinc-800/80 rounded-xl px-4 py-3.5 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner" placeholder="e.g. Harvey Specter" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-1">Professional Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} className="w-full bg-[#08080a] border border-zinc-800/80 rounded-xl px-4 py-3.5 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner" placeholder="attorney@firm.com" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest px-1">Secure Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} className="w-full bg-[#08080a] border border-zinc-800/80 rounded-xl px-4 py-3.5 text-sm text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500/50 transition-colors shadow-inner" placeholder="••••••••" />
            </div>

            <button type="submit" disabled={isLoading} className="w-full mt-4 bg-zinc-100 hover:bg-white text-zinc-950 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue to Verification <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-zinc-800/60 text-center">
            <p className="text-xs text-zinc-600 font-sans">
              Already approved?{" "}
              <Link href="/login" className="text-zinc-400 hover:text-zinc-200 transition-colors underline underline-offset-4">
                Access Workspace
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}