"use client";

import { motion } from "framer-motion";

interface TimelineEvent {
  eventDate: string;
  description: string;
  verifiableSourceCitation: string;
  verified: boolean;
}

interface ChronologyViewerProps {
  events: TimelineEvent[] | string | null;
}

//  Upgraded parser to safely extract JSON even if it's wrapped in AI markdown blocks
function parseEvents(rawEvents: TimelineEvent[] | string | null): TimelineEvent[] {
  if (!rawEvents) return [];
  if (Array.isArray(rawEvents)) return rawEvents;
  
  try {
    const cleanText = rawEvents.replace(/```json\n?|\n?```/g, "").trim();
    const match = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    const parsed = JSON.parse(cleanText);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse chronology timeline", e);
    return [];
  }
}

export default function ChronologyViewer({ events }: ChronologyViewerProps) {
  // Safely parsed events
  const safeEvents = parseEvents(events);

  return (
    <div className="w-full h-187.5 bg-[#08080a] rounded-2xl border border-zinc-800/60 overflow-hidden shadow-2xl font-sans flex flex-col">
      
      {/* HEADER */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/20 px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h3 className="text-zinc-100 text-sm font-medium tracking-wide">Automated Case Chronology</h3>
          <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase mt-1">
            // Verifiable Timeline Matrix
          </p>
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            VERIFIED SOURCE
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
            UNVERIFIED / INFERRED
          </span>
        </div>
      </div>

      {/* TIMELINE CANVAS */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
        {safeEvents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-12 border border-dashed border-zinc-800/60 rounded-2xl">
            <span className="text-2xl mb-4 opacity-50">⏳</span>
            <p className="text-zinc-500 font-mono text-xs">// Chronology buffer empty. Run extraction tool to populate.</p>
          </div>
        ) : (
          <div className="relative max-w-4xl mx-auto">

            <div className="absolute left-4 md:left-8 top-2 bottom-2 w-px bg-linear-to-b from-zinc-800 via-zinc-700 to-zinc-800"></div>

            <div className="space-y-12">
              {safeEvents.map((event, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1, duration: 0.4 }}
                  className="relative pl-12 md:pl-20"
                >
                  {/* Timeline Node arbitrary positioning for perfect alignment */}
                  <div className={`absolute left-2.75 md:left-6.75 top-1 w-2.5 h-2.5 rounded-full border-2 border-[#08080a] z-10 
                    ${event.verified ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]' : 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]'}
                  `} />

                  {/* Event Content Card */}
                  <div className="bg-zinc-900/30 hover:bg-zinc-900/50 transition-colors border border-zinc-800/60 hover:border-zinc-700 rounded-2xl p-5 shadow-lg group">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                      <span className="text-sm font-mono text-zinc-100 bg-zinc-950 px-3 py-1 rounded-md border border-zinc-800 inline-block w-max">
                        {event.eventDate}
                      </span>
                      
                      {!event.verified && (
                        <span className="text-[9px] font-mono text-amber-500 border border-amber-500/30 bg-amber-950/20 px-2 py-0.5 rounded uppercase tracking-widest">
                          Requires Validation
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-zinc-300 leading-relaxed font-light mb-4">
                      {event.description}
                    </p>

                    {/* Verifiable Source Citation Block */}
                    <div className="bg-[#0c0c0e] border border-zinc-800 rounded-lg p-3 relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-800 group-hover:bg-emerald-500/50 transition-colors"></div>
                      <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-1.5 ml-2">
                        // Source Citation
                      </p>
                      <blockquote className="text-xs text-zinc-400 italic ml-2">
                        "{event.verifiableSourceCitation}"
                      </blockquote>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}