// src/app/client/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link"; // <-- Added Next.js Link

//TYPEWRITER COMPONENT
function TypewriterText({ text }: { text: string }) {
  const words = text.split(" ");

  return (
    <span className="inline-block wrap-break-word">
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: i * 0.05,
            duration: 0.1,
          }}
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

export default function ClientDashboard() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ id: string; role: string; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isPdfAttached, setIsPdfAttached] = useState(false);

  //REFS FOR UI BEHAVIOR
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-expand the textarea up to a maximum height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`; 
    }
  }, [input]);

  //POLLING LOGIC
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkAgentStatus = async () => {
      if (!activeSessionId) return;

      try {
        const response = await fetch(`/api/agent/status?sessionId=${activeSessionId}`);
        
        // If the backend isn't ready or returns a 404/500, fail gracefully
        if (!response.ok) return; 
        
        const data = await response.json();

        if (data.status === "COMPLETED") {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: data.content || "Processing complete. No text output returned.",
            },
          ]);
          setIsLoading(false);
          setActiveSessionId(null);
        } else if (data.status === "FAILED") {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: "[System Error]: The orchestration engine encountered a critical failure during execution.",
            },
          ]);
          setIsLoading(false);
          setActiveSessionId(null);
        }
      } catch (error) {
        console.error("Error polling agent status:", error);
      }
    };

    if (activeSessionId) {
      intervalId = setInterval(checkAgentStatus, 3000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activeSessionId]);

  //CORE SUBMISSION LOGIC
  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          clientId: "2c1f0468-f428-48e5-9550-8e135fb43c12", // Placeholder NextAuth ID
          hasPdf: isPdfAttached,
          metadata: {},
        }),
      });

      const data = await response.json();

      if (response.status === 202) {
        setActiveSessionId(data.sessionId);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: `[System]: Intake queued successfully (Session ${data.sessionId.slice(0, 15)}...). Analyzing the request.`,
          },
        ]);
      } else {
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "assistant", content: `[System Error]: ${data.error || "Payload rejected by validation."}` },
        ]);
      }
    } catch (error) {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: "[System Error]: Network Error. Could not reach the backend." },
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage(input);
    }
  };

  return (
    <main className="relative h-screen w-full overflow-hidden bg-[#08080a] text-zinc-200 font-sans flex flex-col selection:bg-zinc-800">
      
      {/* Top Navigation Bar */}
      <header className="relative z-20 flex items-center justify-between border-b border-zinc-800/40 bg-[#08080a]/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium tracking-[0.15em] text-zinc-100 uppercase">LEXIASSIST</h1>
          <span className="rounded-full bg-emerald-950/30 px-2.5 py-0.5 text-[10px] font-mono tracking-widest text-emerald-500 border border-emerald-900/30">
            ENCRYPTED CLIENT INTAKE
          </span>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="relative z-10 flex flex-col lg:flex-row flex-1 overflow-hidden p-4 sm:p-6 gap-6">
        
        {/* LEFT PANE: Document Canvas */}
        <AnimatePresence initial={false}>
          {isPdfAttached && (
            <motion.div
              initial={{ width: 0, opacity: 0, scale: 0.98 }}
              animate={{ width: "50%", opacity: 1, scale: 1 }}
              exit={{ width: 0, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", bounce: 0, duration: 0.5 }}
              className="hidden lg:flex flex-col h-full rounded-2xl border border-zinc-800/60 bg-[#0c0c0e] shadow-2xl overflow-hidden"
            >
              <div className="border-b border-zinc-800/60 bg-zinc-900/30 p-4 flex justify-between items-center">
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Document Canvas</span>
                <span className="text-[10px] font-mono text-zinc-500">contract_draft.pdf</span>
              </div>
              
              <div className="flex-1 relative overflow-y-auto flex items-center justify-center">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />
                 
                 <div className="relative z-10 text-center space-y-6">
                    <div className="relative inline-flex h-16 w-16 items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-20" style={{ animationDuration: '3s' }} />
                        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700/50 shadow-xl">
                            <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200 tracking-wide">Document Ready for Analysis</p>
                      <p className="text-xs text-zinc-500 mt-2 font-mono">LexiAssist is standing by to extract data.</p>
                    </div>
                 </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RIGHT PANE: Chat Assistant */}
        <motion.div
          layout
          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
          className={`flex flex-col h-full rounded-2xl border border-zinc-800/60 bg-[#0c0c0e]/80 backdrop-blur-xl shadow-2xl overflow-hidden ${
            isPdfAttached ? "w-full lg:w-1/2" : "w-full max-w-4xl mx-auto"
          }`}
        >
          {/* Header Panel */}
          <div className="border-b border-zinc-800/60 p-4 bg-zinc-900/20 flex justify-between items-center shrink-0">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              // Active_Triage_Session
            </span>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{isLoading ? "Processing" : "System Ready"}</span>
            </div>
          </div>

          {/* Active Conversational Feed */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
            
            {/* EMPTY STATE */}
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center p-4 max-w-lg mx-auto w-full">
                <div className="h-14 w-14 border border-zinc-800 bg-zinc-900/50 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
                   <span className="text-2xl">⚖️</span>
                </div>
                <p className="font-mono text-xs uppercase tracking-widest text-zinc-300 mb-2">Initialize Triage</p>
                <p className="text-sm text-zinc-500 text-center mb-10 leading-relaxed">Describe your legal issue or select a template below to begin automated structure mapping and risk assessment.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {[
                    "Review this employment contract for unfair non-compete clauses.",
                    "Draft a legally binding Non-Disclosure Agreement (NDA).",
                    "Analyze this eviction notice and check tenant rights.",
                    "Extract a chronological timeline from these case files."
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => submitMessage(prompt)}
                      className="text-left p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/20 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all text-xs text-zinc-400 hover:text-zinc-200 leading-relaxed"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {messages.map((m) => {
                const isSystemMessage = m.content.startsWith("[System") || m.content.startsWith("[System Error]");
                
                if (isSystemMessage) {
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center w-full my-2">
                      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900/40 border border-zinc-800/60 rounded-full text-[10px] font-mono text-zinc-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${m.content.includes("Error") ? "bg-rose-500/80" : "bg-emerald-500/50 animate-pulse"}`} />
                        {m.content.replace(/\[System\]:\s*|\[System Error\]:\s*/, '')}
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div 
                      className={`wrap-break-word whitespace-pre-wrap overflow-hidden max-w-[85%] sm:max-w-[75%] p-5 font-sans text-[14px] leading-relaxed shadow-sm transition-all
                      ${m.role === "user" 
                        ? "bg-zinc-800/60 rounded-2xl rounded-tr-sm text-zinc-100" 
                        : "bg-transparent border border-zinc-800/40 rounded-2xl rounded-tl-sm text-zinc-300"
                      }`}
                    >
                      <p className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mb-3">
                        {m.role === "user" ? "Client" : "LexiAssist"}
                      </p>
                      <div>
                        {m.role === "assistant" ? <TypewriterText text={m.content} /> : m.content}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            <div ref={messagesEndRef} />
          </div>

          {/* Unified Text Entry Port */}
          <div className="p-4 sm:p-6 pt-2 bg-[#0a0a0c] shrink-0">
            {isPdfAttached && (
              <div className="mb-3 px-2 text-[10px] text-emerald-500 font-mono flex items-center gap-2">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-[8px]">✓</span>
                contract_draft.pdf attached
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-2 transition-all focus-within:border-zinc-700/80 focus-within:bg-zinc-900/50">
              
              {/* THIS IS THE UPDATED BUTTON -> NOW A NEXT.JS LINK */}
              <Link
                href="/client/upload"
                title="Upload Document"
                className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl transition-colors ${isPdfAttached ? 'bg-emerald-500/10 text-emerald-400' : 'bg-transparent text-zinc-400 hover:bg-zinc-800/80'}`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </Link>
              
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent py-3 px-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-none overflow-y-auto max-h-32 min-h-11 scrollbar-thin"
                rows={1}
                value={input}
                placeholder="Detail your legal situation..."
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="shrink-0 h-11 w-11 flex items-center justify-center bg-zinc-100 hover:bg-white text-zinc-900 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </main>
  );
}