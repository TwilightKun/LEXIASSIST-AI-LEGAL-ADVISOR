"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { assignLawyerToCase } from "@/app/actions/lawyer";
import { useSession } from "next-auth/react";
import { getChatHistory } from "@/app/actions/chat";
import { getPusherClient } from "@/lib/pusher/client";
import { Loader2 } from "lucide-react";
import { useUploadThing } from "@/utils/uploadthing";


// 1. UTILITIES & CUSTOM COMPONENTS
function TypewriterText({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <span className="inline-block wrap-break-word">
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05, duration: 0.1 }}
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

// Safely extracts JSON payload and handles both MATCH and NO_MATCH scenarios
function tryParseLawyerPayload(content: string) {
  if (typeof content !== 'string') return null;

  const extractReason = (data: any) => data?.reason || data?.matches?.reason || "No available attorneys found for this criteria.";

  try {
    const jsonBlocks = [...content.matchAll(/```json\s*([\s\S]*?)\s*```/g)];

    for (const block of jsonBlocks) {
      try {
        const data = JSON.parse(block[1]);
        if (data?.matchFound === true && Array.isArray(data?.matches)) return { type: "MATCH", data: data.matches };
        if (data?.matchFound === false) return { type: "NO_MATCH", reason: extractReason(data) };
        
        if (data?.matchVerifyLawyer_response?.content?.matchFound === true) return { type: "MATCH", data: data.matchVerifyLawyer_response.content.matches };
        if (data?.matchVerifyLawyer_response?.content?.matchFound === false) return { type: "NO_MATCH", reason: extractReason(data.matchVerifyLawyer_response.content) };
        
        if (data?.type === "LAWYER_MATCH_RESULTS" && Array.isArray(data?.lawyers)) return { type: "MATCH", data: data.lawyers };
      } catch (e) {

      }
    }

    const cleanContent = content.replace(/```json\n?|\n?```/g, "").trim();
    const fallbackData = JSON.parse(cleanContent);
    if (fallbackData?.matchFound === true && Array.isArray(fallbackData?.matches)) return { type: "MATCH", data: fallbackData.matches };
    if (fallbackData?.matchFound === false) return { type: "NO_MATCH", reason: extractReason(fallbackData) };

  } catch (e) {
    return null;
  }
  return null;
}

function LawyerSelectionCard({ lawyers, onSelect, isSelecting }: any) {
  return (
    <div className="w-full max-w-sm bg-[#08080a] border border-zinc-800/80 rounded-2xl p-5 shadow-2xl mt-2">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-8 w-8 rounded-full bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center">
          <span className="text-sm">⚖️</span>
        </div>
        <div>
          <h3 className="text-zinc-100 text-sm font-medium tracking-wide">Matched Attorneys</h3>
          <p className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest">Select to proceed</p>
        </div>
      </div>
      
      <div className="space-y-2">
        {lawyers.map((l: any) => (
          <button 
            key={l.id} 
            onClick={() => onSelect(l.id, l.name)}
            disabled={isSelecting}
            className="w-full text-left p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/20 hover:border-emerald-500/50 hover:bg-emerald-950/10 transition-all group flex justify-between items-center disabled:opacity-50"
          >
            <div>
              <p className="text-zinc-200 text-sm font-medium">{l.name}</p>
              <p className="text-zinc-500 text-xs mt-1">
                {l.jurisdiction} • {l.experienceYrs} yrs experience
              </p>
            </div>
            <span className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1 duration-200">
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Dynamic Agentic "Thinking" Component
function AgentExecutionLoader() {
  const [step, setStep] = useState(0);
  const steps = [
    "Initializing secure orchestration loop...",
    "Analyzing intent and contextual parameters...",
    "Querying legal framework matrix...",
    "Synthesizing structured output..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex justify-start w-full my-4">
      <div className="bg-transparent border border-zinc-800/40 rounded-2xl rounded-tl-sm p-5 w-full max-w-[85%] sm:max-w-[75%] shadow-sm">
        <p className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase mb-4">
          LexiAssist Engine • Working
        </p>
        <div className="space-y-3.5">
          {steps.slice(0, step + 1).map((s, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }} 
              className="flex items-center gap-3 text-xs font-mono"
            >
              {i === step ? (
                <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
              ) : (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500 text-[8px]">
                  ✓
                </span>
              )}
              <span className={i === step ? "text-amber-500 animate-pulse" : "text-zinc-500"}>
                {s}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ==========================================
// 2. MAIN CHAT INTERFACE
// ==========================================

type CaseBrief = { id: string; title: string; status: string; };
interface ChatInterfaceProps {
  activeCaseId: string;
  cases: CaseBrief[];
  onSwitchCase: (caseId: string) => void;
}

export default function ChatInterface({ activeCaseId, cases, onSwitchCase }: ChatInterfaceProps) {
  const { data: session } = useSession();
  const clientId = (session?.user as any)?.id;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ id: string; role: string; content: any }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);

  // INLINE UPLOAD STATE
  const [attachedFile, setAttachedFile] = useState<{url: string, name: string} | null>(null);
  const { startUpload, isUploading } = useUploadThing("pdfUploader");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`; 
    }
  }, [input]);

  // PUSHER WEBSOCKET INTEGRATION
  useEffect(() => {
    if (!activeSessionId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `session-${activeSessionId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind("agent:completed", (data: { status: string; content?: string; error?: string; structuredData?: any }) => {
      if (data.status === "COMPLETED") {
        
        let finalContent = data.content || ""; 

        if (data.structuredData && !finalContent.includes("matchFound")) {
          finalContent = finalContent 
            ? `${finalContent}\n\n\`\`\`json\n${JSON.stringify(data.structuredData)}\n\`\`\`` 
            : `\`\`\`json\n${JSON.stringify(data.structuredData)}\n\`\`\``;
        }

        // Only inject a new message bubble if there is content
        if (finalContent.trim() !== "") {
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), role: "assistant", content: finalContent },
          ]);
        }
        
        setIsLoading(false);
        setActiveSessionId(null);
      } 
      else if (data.status === "FAILED") {
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "assistant", content: `[System Error]: ${data.error || data.content || "The orchestration engine encountered a critical failure."}` },
        ]);
        setIsLoading(false);
        setActiveSessionId(null);
      }
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [activeSessionId]);

  // FETCH CHAT HISTORY ON CASE SWITCH
  useEffect(() => {
    const fetchHistory = async () => {
      setIsFetchingHistory(true);
      setMessages([]); 
      setActiveSessionId(null); 

      const result = await getChatHistory(activeCaseId);
      
      if (result.success) {
        const historicalMessages = (result.messages || []).map((m: any, index: number) => ({
          id: `hist-${Date.now()}-${index}`,
          role: m.role,
          content: m.content,
        }));
        
        setMessages(historicalMessages);
        setActiveSessionId(result.sessionId || null);
      } else {
        setMessages([
          { id: "error", role: "assistant", content: "[System Error]: Failed to retrieve encrypted session history." }
        ]);
      }
      setIsFetchingHistory(false);
    };

    fetchHistory();
  }, [activeCaseId]);

  // CORE SUBMISSION LOGIC
  const submitMessage = async (text: string, isSilentInjection: boolean = false) => {
    if ((!text.trim() && !attachedFile) || isLoading || !clientId || isUploading) return;

    // Append file URL if attached
    const finalPrompt = attachedFile 
      ? `${text}\n\n[Attached File URL: ${attachedFile.url}]` 
      : text;

    if (!isSilentInjection) {
      const userMsg = { id: Date.now().toString(), role: "user", content: finalPrompt };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setAttachedFile(null);
    }
    
    setIsLoading(true);

    try {
      const response = await fetch("/api/agent/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: finalPrompt,
          clientId: clientId,                             
          caseBriefId: activeCaseId,                      
          sessionId: activeSessionId || undefined,        
          hasPdf: !!attachedFile,
          metadata: { isSystemInjection: isSilentInjection },
        }),
      });

      const data = await response.json();

      if (response.status === 202) {
        setActiveSessionId(data.sessionId);
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

  const handleLawyerSelect = async (lawyerId: string, lawyerName: string) => {
    setIsLoading(true);

    const result = await assignLawyerToCase(activeCaseId, lawyerId);
    
    if (result.success) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: `[System]: Attorney ${lawyerName} has been officially secured for this case.` }
      ]);
      
      await submitMessage(`[SYSTEM INSTRUCTION]: The user has selected Attorney ${lawyerName} (ID: ${lawyerId}). Acknowledge this choice briefly and ask the user to upload their legal document for PDF parsing and redline generation.`, true);
    } else {
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: "[System Error]: Failed to secure attorney in the database." }
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
    <div className="relative h-187.5 w-full overflow-hidden bg-[#08080a] text-zinc-200 font-sans flex flex-col rounded-2xl border border-zinc-800/60 shadow-2xl selection:bg-zinc-800">
      
      <header className="relative z-20 flex items-center justify-between border-b border-zinc-800/40 bg-[#08080a]/80 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium tracking-[0.15em] text-zinc-100 uppercase">LEXI CHAT ENGINE</h1>
          <span className="rounded-full bg-emerald-950/30 px-2.5 py-0.5 text-[10px] font-mono tracking-widest text-emerald-500 border border-emerald-900/30">
            ENCRYPTED SESSION
          </span>
        </div>
        
        <select 
          value={activeCaseId}
          onChange={(e) => onSwitchCase(e.target.value)}
          className="appearance-none bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs font-mono py-2 pl-4 pr-10 rounded-lg cursor-pointer hover:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-62.5 truncate"
        >
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.id.slice(0, 4)}...)
            </option>
          ))}
        </select>
      </header>

      <div className="relative z-10 flex flex-col lg:flex-row flex-1 overflow-hidden p-4 sm:p-6 gap-6">
        
        {/* LEFT PANE: Document Canvas */}
        <AnimatePresence initial={false}>
          {attachedFile && (
            <motion.div
              initial={{ width: 0, opacity: 0, scale: 0.98 }}
              animate={{ width: "50%", opacity: 1, scale: 1 }}
              exit={{ width: 0, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", bounce: 0, duration: 0.5 }}
              className="hidden lg:flex flex-col h-full rounded-2xl border border-zinc-800/60 bg-[#0c0c0e] shadow-2xl overflow-hidden"
            >
              <div className="border-b border-zinc-800/60 bg-zinc-900/30 p-4 flex justify-between items-center">
                <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Document Canvas</span>
                <span className="text-[10px] font-mono text-zinc-500 max-w-50 truncate">{attachedFile.name}</span>
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
            attachedFile ? "w-full lg:w-1/2" : "w-full max-w-4xl mx-auto"
          }`}
        >
          <div className="border-b border-zinc-800/60 p-4 bg-zinc-900/20 flex justify-between items-center shrink-0">
            <span className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
              // Active_Triage_Session
            </span>
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${isLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
              <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{isLoading ? "Processing" : "System Ready"}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
            
            {isFetchingHistory ? (
              <div className="h-full flex flex-col items-center justify-center p-4">
                <span className="h-6 w-6 rounded-full bg-emerald-500/50 animate-ping mb-4" />
                <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Decrypting Session History...</p>
              </div>
            ) : messages.length === 0 ? (
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
            ) : null}

            <AnimatePresence>
              {messages.map((m) => {
                
                const isSystemMessage = typeof m.content === "string" && (m.content.startsWith("[System") || m.content.startsWith("[System Error]"));
                const parsedLawyers = typeof m.content === "string" ? tryParseLawyerPayload(m.content) : null;

                // SCENARIO 1: MATCH FOUND
                if (parsedLawyers?.type === "MATCH") {
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start w-full my-4">
                      <LawyerSelectionCard 
                        lawyers={parsedLawyers.data} 
                        onSelect={handleLawyerSelect} 
                        isSelecting={isLoading}
                      />
                    </motion.div>
                  );
                }

                // SCENARIO 2: NO MATCH FOUND
                if (parsedLawyers?.type === "NO_MATCH") {
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start w-full my-4">
                      <div className="w-full max-w-sm bg-[#08080a] border border-amber-900/50 rounded-2xl p-5 shadow-2xl mt-2">
                        <div className="flex items-center gap-2 mb-2 text-amber-500">
                          <span className="text-lg">⚠️</span>
                          <h3 className="text-sm font-medium tracking-wide">No Matches Found</h3>
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{parsedLawyers.reason}</p>
                      </div>
                    </motion.div>
                  );
                }

                // SCENARIO 3: SYSTEM MESSAGES
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

                // CLEANUP: Hide <scratchpad> and raw JSON
                let displayContent = m.content;
                if (typeof m.content === "string") {
                  // 1. Remove the AI's internal reasoning completely
                  displayContent = displayContent.replace(/<scratchpad>[\s\S]*?<\/scratchpad>/gi, '').trim();
                  // 2. Remove ALL injected JSON blocks from the visual chat bubble
                  displayContent = displayContent.replace(/```json[\s\S]*?```/gi, '').trim();
                }

                // If the message was ONLY a scratchpad or hidden JSON, hide the empty bubble entirely
                if (!displayContent && m.role === "assistant") 
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start w-full my-4">
                      <div className="flex items-center gap-3 px-5 py-4 bg-emerald-950/10 border border-emerald-900/30 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-sm">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        </span>
                        <div>
                          <p className="text-[10px] font-mono tracking-widest text-emerald-500 uppercase mb-1">Analysis Complete</p>
                          <p className="text-xs text-zinc-400 font-sans leading-relaxed">Structural data has been extracted and securely routed to your visualization matrices.</p>
                        </div>
                      </div>
                    </motion.div>
                  );

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
                        {m.role === "assistant" && typeof displayContent === "string" ? (
                          <TypewriterText text={displayContent} />
                        ) : typeof displayContent === "string" ? (
                          displayContent
                        ) : (
                          <div className="text-[11px] font-mono text-zinc-500 bg-zinc-950/40 p-2 rounded border border-zinc-900 mt-2">
                            🔧 Executing specialized legal utility algorithms...
                          </div>
                        )}
                      </div>

                    </div>
                  </motion.div>
                );
              })}
              
              {isLoading && <AgentExecutionLoader />}
              
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 sm:p-6 pt-2 bg-[#0a0a0c] shrink-0">
            {attachedFile && (
              <div className="mb-3 px-3 py-1.5 bg-emerald-950/30 border border-emerald-900/50 rounded-md w-fit flex items-center gap-2 text-[10px] text-emerald-500 font-mono">
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500/20 text-[8px]">✓</span>
                {attachedFile.name} attached
                <button onClick={() => setAttachedFile(null)} className="ml-2 text-zinc-500 hover:text-rose-400">✕</button>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-zinc-900/30 border border-zinc-800/60 rounded-2xl p-2 transition-all focus-within:border-zinc-700/80 focus-within:bg-zinc-900/50">
              
              <label className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl transition-colors cursor-pointer ${attachedFile ? 'bg-emerald-500/10 text-emerald-400' : 'bg-transparent text-zinc-400 hover:bg-zinc-800/80'} ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input 
                  type="file" 
                  accept="application/pdf"
                  className="hidden" 
                  disabled={isUploading || isLoading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const res = await startUpload([file]);
                    if (res && res[0]) {
                      setAttachedFile({ url: res[0].url, name: res[0].name });
                    }
                  }} 
                />
                {isUploading ? (
                  <span className="h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
              </label>
              
              <textarea
                ref={textareaRef}
                className="flex-1 bg-transparent py-3 px-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-none overflow-y-auto max-h-32 min-h-11 scrollbar-thin"
                rows={1}
                value={input}
                placeholder="Detail your legal situation..."
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || !clientId || isUploading}
              />
              
              <button
                type="submit"
                disabled={isLoading || (!input.trim() && !attachedFile) || !clientId || isUploading}
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
    </div>
  );
}