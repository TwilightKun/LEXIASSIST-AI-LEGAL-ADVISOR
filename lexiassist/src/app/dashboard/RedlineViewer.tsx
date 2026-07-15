"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { getCaseDocument } from "@/app/actions/document";
import { Loader2 } from "lucide-react";

interface FlaggedClause {
  originalTextSnippet: string;
  riskSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  suggestedRedline: string;
  rationale: string;
}

// Utility to safely extract JSON, handling both Prisma Arrays and AI strings
function parseRedlines(data: any): FlaggedClause[] {
  if (!data) return [];
  
  // 1. If Prisma already handed us a perfectly parsed array, just return it!
  if (Array.isArray(data)) return data;

  // 2. If it's a string, safely attempt to parse it
  if (typeof data === "string") {
    if (data === "Pending extraction...") return [];
    try {
      const cleanText = data.replace(/```json\n?|\n?```/g, "").trim();
      const match = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      const parsed = JSON.parse(cleanText);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to parse redlines payload:", e);
      return [];
    }
  }

  return [];
}

export default function RedlineViewer({ activeCaseId, isActive = true }: { activeCaseId: string, isActive?: boolean }) {
  const [doc, setDoc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string | null>(null);

  // FETCH DOCUMENT DATA (Memoized so it can be called on mount and on manual sync)
  const loadDocument = useCallback(async (isManualSync = false) => {
    if (isManualSync) setIsSyncing(true);
    else setIsLoading(true);

    try {
      const result = await getCaseDocument(activeCaseId);
      if (result?.success && result.document) {
        setDoc(result.document);
      }
    } catch (error) {
      console.error("Failed to fetch document buffer:", error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [activeCaseId]);

  // Initial Load & Tab Switch Refresh
  useEffect(() => {
    if (activeCaseId && isActive) {
      loadDocument();
    }
  }, [activeCaseId, isActive, loadDocument]);

  const severityColors: Record<string, string> = {
    LOW: "border-blue-500/30 bg-blue-950/10 text-blue-400",
    MEDIUM: "border-amber-500/30 bg-amber-950/10 text-amber-400",
    HIGH: "border-orange-500/30 bg-orange-950/10 text-orange-400",
    CRITICAL: "border-rose-500/30 bg-rose-950/10 text-rose-400",
  };

  // 1. LOADING STATE
  if (isLoading) {
    return (
      <div className="flex flex-col h-187.5 items-center justify-center border border-zinc-800/60 bg-[#0c0c0e]/80 rounded-2xl shadow-2xl">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-4" />
        <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Retrieving Encrypted Vault Data...</p>
      </div>
    );
  }

  // 2. NO DOCUMENT STATE
  if (!doc) {
    return (
      <div className="flex flex-col h-187.5 items-center justify-center border border-zinc-800/60 bg-[#0c0c0e]/80 rounded-2xl shadow-2xl p-8 text-center">
        <h3 className="text-zinc-200 font-medium tracking-wide mb-2">No Document Found</h3>
        <p className="text-zinc-500 text-sm max-w-md">
          You have not uploaded a document for this case yet. Please return to the AI Intake Chat and upload a PDF to generate redlines.
        </p>
      </div>
    );
  }

  // 3. MAIN UI STATE
  const flaggedClauses = parseRedlines(doc.redlines);
  
  const isPending = 
    !doc.extractedText || 
    doc.extractedText === "Pending extraction..." || 
    (!doc.redlines && doc.extractedText);
   
  const filteredClauses = selectedRiskFilter
    ? flaggedClauses.filter((c) => c.riskSeverity === selectedRiskFilter)
    : flaggedClauses;

  return (
    <div className="w-full h-187.5 flex flex-col lg:flex-row bg-[#08080a] rounded-2xl border border-zinc-800/60 overflow-hidden shadow-2xl font-sans">
      
      {/* LEFT PORT: 50% ORIGINAL PDF VIEWPORT */}
      <div className="w-full lg:w-1/2 h-full border-b lg:border-b-0 lg:border-r border-zinc-800/60 flex flex-col bg-[#0c0c0e]">
        <div className="border-b border-zinc-800/60 bg-zinc-900/20 px-6 py-4 flex justify-between items-center shrink-0">
          <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">// Document_Canvas</span>
          <span className="text-[10px] text-zinc-600 font-mono">ID: {doc.id.slice(0, 8)}</span>
        </div>
        <div className="flex-1 w-full bg-zinc-950 relative">
          {doc.fileUrl ? (
            <iframe 
              src={`${doc.fileUrl}#toolbar=0`} 
              className="w-full h-full border-none invert opacity-90 grayscale contrast-125"
              title="Original Document Draft View"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 font-mono text-xs">
              [No document buffer found linked to context matrix]
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PORT: 50% INTELLIGENT REDLINES ASSESSMENT */}
      <div className="w-full lg:w-1/2 h-full flex flex-col bg-[#08080a]">
        
        {/* Sub-Header & Dynamic Filter Tabs */}
        <div className="border-b border-zinc-800/60 bg-zinc-900/20 px-6 py-4 shrink-0 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">// Dynamic_Redline_Matrix</span>
            
            <div className="flex items-center gap-3">
              {/* SPA-Safe Manual Sync Button */}
              {isPending && (
                <button 
                  onClick={() => loadDocument(true)}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 text-[9px] font-mono border border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 px-2 py-0.5 rounded text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
                >
                  <Loader2 className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "SYNCING..." : "FORCE SYNC"}
                </button>
              )}

              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${isPending ? "text-amber-500 bg-amber-950/30 border-amber-900/30" : "text-emerald-500 bg-emerald-950/30 border-emerald-900/30"}`}>
                {isPending ? "Extraction Processing..." : `${flaggedClauses.length} Anomalies Found`}
              </span>
            </div>
          </div>
          
          {!isPending && (
            <div className="flex gap-1.5 flex-wrap">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((tier) => (
                <button
                  key={tier}
                  onClick={() => setSelectedRiskFilter(tier === "ALL" ? null : tier)}
                  className={`px-3 py-1 rounded-md text-[10px] font-mono border transition-all uppercase tracking-wider
                    ${(selectedRiskFilter === tier || (tier === "ALL" && !selectedRiskFilter))
                      ? "bg-zinc-100 text-zinc-900 border-zinc-100 font-bold"
                      : "border-zinc-800/80 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                    }
                  `}
                >
                  {tier}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Issues Stack */}
        <div className="flex-1 overflow-y-auto p-6 pb-24 space-y-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
          
          {isPending ? (
            <div className="h-full flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-4" />
              <p className="text-zinc-300 font-medium">QStash Engine Active</p>
              <p className="text-zinc-500 text-xs mt-2 font-mono">Awaiting structural analysis payload...</p>
            </div>
          ) : flaggedClauses.length === 0 ? (
            /* SCENARIO 1: Document is truly risk-free (Show Raw Extraction + Clear Compliance Layout) */
            <div className="h-full flex flex-col gap-4">
              <div className="flex items-center justify-center border border-dashed border-zinc-800/60 rounded-xl py-12">
                <p className="text-zinc-500 font-mono text-xs">// Clear compliance layout. No JSON risks detected.</p>
              </div>
              
              <div className="border border-zinc-800/60 rounded-xl p-4 bg-zinc-900/30">
                <p className="text-[10px] font-mono text-zinc-500 uppercase mb-2">// Raw Extraction Layer</p>
                <div className="text-xs text-zinc-400 font-sans whitespace-pre-wrap leading-relaxed">
                  {doc.extractedText}
                </div>
              </div>
            </div>
          ) : filteredClauses.length === 0 ? (
            /* SCENARIO 2: Risks exist in the document, but none match the clicked tab filter */
            <div className="flex flex-col items-center justify-center border border-dashed border-zinc-800/60 rounded-xl py-12 mt-4 bg-zinc-900/10">
              <span className="text-lg mb-2">🛡️</span>
              <p className="text-zinc-400 font-medium text-xs uppercase tracking-wider">Tier Clear</p>
              <p className="text-zinc-500 font-mono text-[10px] mt-1">// No {selectedRiskFilter} risk anomalies detected in this tier.</p>
            </div>
          ) : (
            /* SCENARIO 3: Render the active filtered anomalies */
            filteredClauses.map((clause, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-xl border flex flex-col gap-4 ${severityColors[clause.riskSeverity] || "border-zinc-700 text-zinc-300"}`}
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[9px] font-mono uppercase tracking-widest px-2 py-0.5 rounded border bg-zinc-900/80 border-current/20 font-bold">
                      {clause.riskSeverity} RISK
                    </span>
                  </div>
                </div>

                {/* Side-by-Side Clause Analysis Box */}
                <div className="space-y-3 font-sans">
                  <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-3">
                    <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// Source Text Clause:</p>
                    <blockquote className="text-xs text-zinc-400 italic line-through decoration-rose-500/40">
                      "{clause.originalTextSnippet}"
                    </blockquote>
                  </div>

                  <div className="bg-emerald-950/10 border border-emerald-900/30 rounded-lg p-3">
                    <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-wider mb-1">// Neutralized Redline Suggestion:</p>
                    <p className="text-xs text-zinc-200 font-medium">
                      {clause.suggestedRedline}
                    </p>
                  </div>
                </div>

                {/* Rationale Breakdown */}
                <div className="border-t border-zinc-800/40 pt-3">
                  <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">// Risk Mitigation Rationale:</p>
                  <p className="text-xs text-zinc-300 leading-relaxed font-light">
                    {clause.rationale}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}