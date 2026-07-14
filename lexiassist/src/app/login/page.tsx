"use client";

import { useState } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false, 
      });

      if (res?.error) {
        setError("Invalid email or password. Access denied.");
        setIsLoading(false);
      } else {
        // 1. Fetch the active session to see WHO just logged in
        const session = await getSession();
        
        // 2. Check the role and route them to the correct app zone
        if (session?.user?.role === "LAWYER") {
          router.push("/dashboard");
        } else {
          router.push("/client");
        }
        
        router.refresh(); 
      }
    } catch (err) {
      setError("A critical system error occurred.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-[#08080a] flex items-center justify-center p-4 selection:bg-zinc-800">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-[#0c0c0e]/90 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-8 shadow-2xl"
      >
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 mb-4 shadow-lg">
            <span className="text-xl">⚖️</span>
          </div>
          <h1 className="text-xl font-medium tracking-[0.15em] text-zinc-100 uppercase">LEXIASSIST</h1>
          <p className="text-[10px] font-mono tracking-widest text-emerald-500 uppercase mt-2">
            Secure Node Authorization
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-center">
              <p className="text-xs font-mono text-rose-400 uppercase tracking-wide">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase px-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              placeholder="client@domain.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase px-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full mt-4 bg-zinc-100 hover:bg-white text-zinc-900 font-medium text-sm px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-xs uppercase tracking-widest">Authenticating</span>
              </>
            ) : (
              <span className="font-mono text-xs uppercase tracking-widest text-black">Initialize Session</span>
            )}
          </button>
        </form>
      </motion.div>
    </main>
  );
}