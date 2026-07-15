"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import IpBox from "./ip";

const initialCards = [
  {
    id: 1,
    title: "CONTRACT.pdf",
    x: -180,
    y: -120,
    rot: -8,
  },
  {
    id: 2,
    title: "EMAIL.msg",
    x: 170,
    y: -100,
    rot: 6,
  },
  {
    id: 3,
    title: "EVIDENCE.zip",
    x: -160,
    y: 90,
    rot: 4,
  },
  {
    id: 4,
    title: "NOTES.txt",
    x: 160,
    y: 110,
    rot: -6,
  },
  {
    id: 5,
    title: "STATEMENT.doc",
    x: 0,
    y: 0,
    rot: 2,
  },
];

export default function Home() {
  const [moved, setMoved] = useState<number[]>([]);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const width = window.innerWidth;

      if (width < 640) {
        setScale(0.45);
      } else if (width < 1024) {
        setScale(0.7);
      } else {
        setScale(1);
      }
    };

    updateScale();

    window.addEventListener("resize", updateScale);

    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const reveal = moved.length === initialCards.length;

  const markMoved = (id: number) => {
    setMoved((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-[#0b0b0b] text-zinc-200">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#222_0%,#111_45%,#080808_100%)]" />

      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "url('https://www.transparenttextures.com/patterns/asfalt-dark.png')",
        }}
      />

      {/* Logo */}
      <div className="absolute left-4 top-4 z-50 sm:left-6 sm:top-6 lg:left-10 lg:top-10">
        <h1 className="text-2xl font-light tracking-[0.22em] sm:text-3xl sm:tracking-[0.3em] lg:text-4xl lg:tracking-[0.35em]">
          LEXIASSIST
        </h1>

        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500 sm:text-xs">
          AI Legal Advisor
        </p>
      </div>

      {/* Counter */}
      <div className="absolute right-4 top-4 z-50 text-right text-zinc-500 sm:right-6 sm:top-6 lg:right-10 lg:top-10">
        <p className="text-[10px] uppercase tracking-[0.25em] sm:text-xs">
          Evidence moved
        </p>

        <p className="mt-1 text-lg font-light sm:text-2xl lg:mt-2 lg:text-3xl">
          {moved.length}/{initialCards.length}
        </p>
      </div>

      {/* Hero */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: reveal ? 1 : 0.08,
            scale: reveal ? 1 : 0.92,
          }}
          transition={{ duration: 1 }}
          className="text-center"
        >
          <h2 className="select-none text-4xl font-thin tracking-[0.25em] text-white sm:text-6xl sm:tracking-[0.45em] lg:text-7xl lg:tracking-[0.6em]">
            TRUTH
          </h2>

          <motion.p
            animate={{
              opacity: reveal ? 1 : 0,
              y: reveal ? 0 : 20,
            }}
            transition={{ delay: 0.6 }}
            className="mx-auto mt-6 max-w-md px-4 text-sm text-zinc-400 sm:text-base"
          >
            Every legal story begins by uncovering what was hidden.
          </motion.p>

          {reveal && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 sm:mt-10 flex flex-col items-center gap-4"
            >
              {/* Client Route - Standard Link */}
              <Link
                href="/login"
                className="inline-block rounded-full border border-zinc-700 px-6 py-3 text-xs uppercase tracking-[0.25em] transition hover:border-zinc-300 hover:bg-white hover:text-black sm:px-8 sm:text-sm"
              >
                ENTER INTAKE PORTAL
              </Link>
              
              {/* Lawyer Route - Next.js SPA Link */}
              <Link
                href="/login"
                className="text-[10px] uppercase tracking-widest text-zinc-600 hover:text-emerald-500 transition-colors"
              >
                ATTORNEY ACCESS
              </Link>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Cards */}
      {initialCards.map((card) => (
        <motion.div
          key={card.id}
          drag
          dragMomentum={false}
          dragElastic={0.12}
          onDragStart={() => markMoved(card.id)}
          initial={{
            x: card.x * scale,
            y: card.y * scale,
            rotate: card.rot,
          }}
          whileDrag={{
            scale: 1.06,
            rotate: 0,
            cursor: "grabbing",
            zIndex: 999,
          }}
          className="absolute left-1/2 top-1/2 h-36 w-56 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-md border border-zinc-800 bg-[#151515]/90 p-4 shadow-2xl backdrop-blur-sm sm:h-40 sm:w-64 sm:p-5 lg:h-44 lg:w-72"
        >
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 sm:text-xs">
                Confidential
              </p>

              <h3 className="mt-3 text-base tracking-wide sm:text-lg">
                {card.title}
              </h3>
            </div>

            <div className="space-y-2">
              <div className="h-px w-full bg-zinc-800" />
              <div className="h-px w-5/6 bg-zinc-800" />
              <div className="h-px w-4/6 bg-zinc-800" />
            </div>
          </div>
        </motion.div>
      ))}

      {/* Bottom Left */}
      <div className="absolute bottom-4 left-4 z-50 max-w-xs text-zinc-500 sm:bottom-6 sm:left-6 sm:max-w-sm lg:bottom-10 lg:left-10">
        <p className="text-[10px] uppercase tracking-[0.22em] sm:text-xs">
          Every case hides something.
        </p>

        <p className="mt-2 text-xs sm:text-sm">
          Move every file.
          <br />
          Find the truth.
        </p>
      </div>

      {/* Bottom Right */}
      <div className="absolute bottom-4 right-4 z-50 sm:bottom-6 sm:right-6 lg:bottom-10 lg:right-10">
        <IpBox />
      </div>

      {/* Footer */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-4 text-center text-[10px] uppercase tracking-[0.25em] text-zinc-700 sm:bottom-4 sm:text-xs lg:bottom-8">
        Nothing is ever hidden forever.
      </div>
    </main>
  );
}