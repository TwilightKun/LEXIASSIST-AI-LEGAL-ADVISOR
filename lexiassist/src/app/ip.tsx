"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function IpBox() {
  const [ip, setIp] = useState("Locating...");

  useEffect(() => {
    const fetchIP = async () => {
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();

        // Mask the last two octets for the joke
       setIp(data.ip);
      } catch {
        setIp("Unknown");
      }
    };

    fetchIP();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="
        mt-4
        w-full
        max-w-[280px]
        sm:max-w-[320px]
        rounded-sm
        border
        border-zinc-800/70
        bg-white/[0.02]
        p-3
        sm:p-4
        backdrop-blur-sm
        font-mono
        text-[10px]
        sm:text-[11px]
        tracking-[0.08em]
        text-zinc-500
      "
    >
      <p className="mb-3 uppercase tracking-[0.28em] text-zinc-600 sm:tracking-[0.35em]">
        SYSTEM LOG
      </p>

      <div className="space-y-2 sm:space-y-3">
        <p>
          <span className="text-zinc-700">&gt;</span> scanning client...
        </p>

        <p className="flex flex-wrap gap-1">
          <span className="text-zinc-700">&gt;</span>
          <span>IP</span>
          <span className="break-all text-zinc-300">{ip}</span>
        </p>

        <div className="my-3 h-px bg-zinc-800" />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="break-words text-zinc-400"
        >
          &gt; Found you lil bro 👉😂
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.65 }}
          transition={{ delay: 1.8 }}
          className="italic text-zinc-600"
        >
          Pack it up unc.
        </motion.p>
      </div>
    </motion.div>
  );
}