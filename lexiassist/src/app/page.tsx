"use client";

import { motion } from "framer-motion";
import { useState } from "react";

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

  const reveal = moved.length === initialCards.length;

  const markMoved = (id: number) => {
    if (!moved.includes(id)) {
      setMoved((prev) => [...prev, id]);
    }
  };

  return (
    <main className="relative flex h-screen w-screen overflow-hidden bg-[#0b0b0b] text-zinc-200">
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

      {/* Top Left */}
      <div className="absolute left-10 top-10 z-50">
        <h1 className="text-4xl font-light tracking-[0.35em]">
          LEXIASSIST
        </h1>

        <p className="mt-3 text-sm tracking-[0.2em] uppercase text-zinc-500">
          AI Legal Advisor
        </p>
      </div>

      {/* Bottom Left */}
      <div className="absolute bottom-10 left-10 text-zinc-500">
        <p className="text-xs tracking-[0.25em] uppercase">
          Every case hides something.
        </p>

        <p className="mt-2 text-sm">
          Move every file.
          <br />
          Find the truth.
        </p>
      </div>

      {/* Counter */}
      <div className="absolute right-10 top-10 text-right text-zinc-500">
        <p className="text-xs uppercase tracking-[0.3em]">
          Evidence moved
        </p>

        <p className="mt-2 text-3xl font-light">
          {moved.length}/{initialCards.length}
        </p>
      </div>

      {/* Truth */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{
            opacity: reveal ? 1 : 0.08,
            scale: reveal ? 1 : 0.92,
          }}
          transition={{ duration: 1 }}
          className="text-center"
        >
          <h2 className="select-none text-7xl font-thin tracking-[0.6em] text-white">
            TRUTH
          </h2>

          <motion.p
            animate={{
              opacity: reveal ? 1 : 0,
              y: reveal ? 0 : 20,
            }}
            transition={{ delay: 0.6 }}
            className="mt-8 text-zinc-400"
          >
            Every legal story begins by uncovering what was hidden.
          </motion.p>

          {reveal && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{
                scale: 1.05,
              }}
              className="mt-10 rounded-full border border-zinc-700 px-8 py-3 text-sm uppercase tracking-[0.3em] transition hover:border-zinc-300 hover:bg-white hover:text-black"
            >
              IN DEVELOPMENT NOW
            </motion.button>
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
            x: card.x,
            y: card.y,
            rotate: card.rot,
          }}
          whileDrag={{
            scale: 1.06,
            rotate: 0,
            cursor: "grabbing",
            zIndex: 999,
          }}
          className="absolute left-1/2 top-1/2 h-44 w-72 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-md border border-zinc-800 bg-[#151515]/90 p-5 backdrop-blur-sm shadow-2xl"
        >
          <div className="flex h-full flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                Confidential
              </p>

              <h3 className="mt-3 text-lg tracking-wide">
                {card.title}
              </h3>
            </div>

            <div className="space-y-2">
              <div className="h-[1px] w-full bg-zinc-800" />
              <div className="h-[1px] w-5/6 bg-zinc-800" />
              <div className="h-[1px] w-4/6 bg-zinc-800" />
            </div>
          </div>
        </motion.div>
      ))}

      {/* Footer */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs tracking-[0.35em] uppercase text-zinc-700">
        Nothing is ever hidden forever.
      </div>
    </main>
  );
}