// src/app/dashboard/ChatInterface.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { assignLawyerToCase } from "@/app/actions/lawyer";
import { useSession } from "next-auth/react";
import { getChatHistory } from "@/app/actions/chat";
import { saveDocumentRecord } from "@/app/actions/document";
import { getPusherClient } from "@/lib/pusher/client";
import { Loader2, Terminal, CheckCircle2, ShieldAlert, WifiOff } from "lucide-react";
import { useUploadThing } from "@/utils/uploadthing";
import { useAgentSession } from "@/hooks/useAgentSession";

// ----------------------------------------------------------------------
// STRUCTURED TOOL DATA & TYPES
// ----------------------------------------------------------------------

type ChatMessage = {
  id: string;
  role: string;
  content: any;
  structuredData?: { matchFound: boolean; matches?: any[]; reason?: string } | null;
};

// EXPLICIT TYPE FIX: This forces TypeScript to recognize the exact shapes,
// fixing the "Property 'data' does not exist" errors in the map loop.
type ParsedLawyerResult = 
  | { type: "MATCH"; data: any[] } 
  | { type: "NO_MATCH"; reason: string } 
  | null;

function tryParseLawyerPayload(content: string): ParsedLawyerResult {
  if (typeof content !== 'string') return null;
  const extractReason = (data: any) => data?.reason || data?.matches?.reason || "No available attorneys found for this specific criteria.";

  try {
    const jsonBlocks = [...content.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
    for (const block of jsonBlocks) {
      try {
        const data = JSON.parse(block[1]);
        if (data?.matchFound === true && Array.isArray(data?.matches)) return { type: "MATCH", data: data.matches };
        if (data?.matchFound === false) return { type: "NO_MATCH", reason: extractReason(data) };
      } catch (e) {}
    }
  } catch (e) { return null; }
  return null;
}

function extractToolResultStructuredData(m: { role: string; content: any }): ChatMessage["structuredData"] {
  if (m.role !== "tool" || !Array.isArray(m.content)) return null;
  const lawyerResult = m.content.find((c: any) => c?.toolName === "matchVerifyLawyer");
  const value = lawyerResult?.output?.value;
  if (!value || typeof value.matchFound !== "boolean") return null;
  return value;
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
              <p className="text-zinc-500 text-xs mt-1">{l.jurisdiction} • {l.experienceYrs} yrs experience</p>
            </div>
            <span className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1 duration-200">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AgentExecutionLoader({ realTimeStep }: { realTimeStep?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="flex justify-start w-full my-4">
      <div className="bg-[#08080a] border border-zinc-800/60 rounded-2xl p-4 w-full max-w-[85%] sm:max-w-[75%] shadow-lg flex items-center gap-4">
        <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
        </div>
        <div>
          <p className="text-[10px] font-mono tracking-widest text-emerald-500 uppercase mb-1">System Processing</p>
          <p className="text-xs text-zinc-400 font-mono animate-pulse">{realTimeStep || "Analyzing contextual parameters..."}</p>
        </div>
      </div>
    </motion.div>
  );
}

function RealtimeDegradedBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center w-full mb-2">
      <div className="flex items-center gap-3 px-4 py-2 bg-amber-950/20 border border-amber-900/40 rounded-full text-[10px] font-mono text-amber-500">
        <WifiOff className="w-3 h-3" />
        Realtime connection lost — responses may be delayed.
        <button onClick={onRetry} className="underline hover:text-amber-300 transition-colors">Reconnect</button>
      </div>
    </motion.div>
  );
}

interface ChatInterfaceProps {
  activeCaseId: string;
  cases: { id: string; title: string; status: string }[];
  onSwitchCase: (caseId: string) => void;
}

export default function ChatInterface({ activeCaseId, cases, onSwitchCase }: ChatInterfaceProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const clientId = (session?.user as any)?.id;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);

  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  const [isInjecting, setIsInjecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAwaitingResponse, setIsAwaitingResponse] = useState(false);
  const [realtimeDegraded, setRealtimeDegraded] = useState(false);

  const [attachedFile, setAttachedFile] = useState<{url: string, name: string, id: string} | null>(null);
  const { startUpload, isUploading } = useUploadThing("pdfUploader");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { status, currentStepText } = useAgentSession(activeSessionId);
  const isAgentLoading = isInjecting || isLoading || isAwaitingResponse;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`; 
    }
  }, [input]);

  const finishAgentTurn = (content: string, structuredData: any) => {
    let finalContent = content || "";
    if (finalContent.trim() !== "" || structuredData) {
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: finalContent, structuredData: structuredData ?? null }]);
    }
    setIsLoading(false);
    setIsAwaitingResponse(false);
    window.dispatchEvent(new Event('refresh-case-data'));
    router.refresh();
  };

  useEffect(() => {
    if (!activeSessionId) return;
    const pusher = getPusherClient();
    if (!pusher) {
      setRealtimeDegraded(true);
      return;
    }

    const channelName = `session-${activeSessionId}`;
    const channel = pusher.subscribe(channelName);

    const handleStateChange = (states: { current: string }) => {
      if (states.current === 'disconnected' || states.current === 'failed' || states.current === 'unavailable') {
        setRealtimeDegraded(true);
      } else if (states.current === 'connected') {
        setRealtimeDegraded(false);
      }
    };
    pusher.connection.bind('state_change', handleStateChange);

    channel.bind("agent:completed", (data: { status: string; content?: string; error?: string; structuredData?: any }) => {
      if (data.status === "COMPLETED") {
        finishAgentTurn(data.content || "", data.structuredData);
      } else if (data.status === "FAILED") {
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: `[System Error]: ${data.error || data.content || "Orchestration engine failure."}` }]);
        setIsLoading(false);
        setIsAwaitingResponse(false);
      }
    });

    return () => {
      pusher.connection.unbind('state_change', handleStateChange);
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [activeSessionId, router]);

  useEffect(() => {
    if (!realtimeDegraded || !activeSessionId || !isAwaitingResponse) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/agent/status?sessionId=${activeSessionId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "COMPLETED") {
          finishAgentTurn(data.content || "", data.metadata?.structuredData);
        } else if (data.status === "FAILED") {
          setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "[System Error]: Orchestration engine failure." }]);
          setIsLoading(false);
          setIsAwaitingResponse(false);
        }
      } catch {
        // Network hiccup mid-poll — just retry on the next tick.
      }
    }, 4000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [realtimeDegraded, activeSessionId, isAwaitingResponse]);

  const retryRealtimeConnection = () => {
    const pusher = getPusherClient();
    if (pusher?.connection?.state !== 'connected') {
      pusher?.connect();
    }
    setRealtimeDegraded(false);
  };

  useEffect(() => {
    const fetchHistory = async () => {
      setIsFetchingHistory(true);
      setMessages([]); 
      setActiveSessionId(null); 
      setAttachedFile(null);
      setCurrentDocumentId(null); 
      setIsLoading(false);
      setIsAwaitingResponse(false);
      setIsInjecting(false);

      const result = await getChatHistory(activeCaseId);
      if (result.success) {
        const rawMessages = (result.messages as any[]) || [];
        const historicalMessages: ChatMessage[] = [];

        for (let index = 0; index < rawMessages.length; index++) {
          const m = rawMessages[index];

          if (m.role === "tool") {
            const structuredData = extractToolResultStructuredData(m);
            if (structuredData) {
              historicalMessages.push({
                id: `hist-${Date.now()}-${index}`,
                role: "assistant",
                content: "",
                structuredData,
              });
            }
            continue;
          }

          if (m.role === "assistant" && Array.isArray(m.content)) {
            continue;
          }

          historicalMessages.push({
            id: `hist-${Date.now()}-${index}`,
            role: m.role,
            content: m.content,
          });
        }

        setMessages(historicalMessages);
        setActiveSessionId(result.sessionId || null);
      }
      setIsFetchingHistory(false);
    };
    fetchHistory();
  }, [activeCaseId]);

  const submitMessage = async (text: string, isSilentInjection: boolean = false) => {
    if ((!text.trim() && !attachedFile) || isAgentLoading || !clientId || isUploading) return;

    let apiPrompt = text.trim();
    
    if (attachedFile) {
      apiPrompt += `\n\n[Attachment Name: ${attachedFile.name}]`;
      apiPrompt += `\n[Attached File URL: ${attachedFile.url}]`;
      setCurrentDocumentId(attachedFile.id); 
    }

    const docIdToUse = attachedFile?.id || currentDocumentId;
    apiPrompt += `\n\n[STRICT SYSTEM INSTRUCTIONS]:\n`;
    if (activeSessionId) apiPrompt += `- caseSessionId: "${activeSessionId}"\n`;
    if (docIdToUse) apiPrompt += `- documentId: "${docIdToUse}"\n`;
    apiPrompt += `- RULES: If you execute Chronology or Redlines tools, do it silently (do not output the results in text). HOWEVER, if you execute the 'matchVerifyLawyer' tool, you MUST output the raw JSON result inside a \`\`\`json block so the UI can render the selection cards.`;

    if (!isSilentInjection) {
      const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: apiPrompt };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setAttachedFile(null); 
    } else {
      setIsInjecting(true);
    }
    
    setIsLoading(true);
    setIsAwaitingResponse(true);

    try {
      const payload: any = {
        prompt: apiPrompt,
        caseBriefId: activeCaseId, 
        hasPdf: !!attachedFile,
        metadata: {},
      };

      if (activeSessionId) payload.sessionId = activeSessionId;
      if (attachedFile?.url) payload.fileUrl = attachedFile.url;

      const response = await fetch("/api/agent/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.status === 202) {
        if (!activeSessionId) setActiveSessionId(data.sessionId);
      } else {
        setIsLoading(false);
        setIsAwaitingResponse(false);
        if (isSilentInjection) setIsInjecting(false);
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: `[System Error]: ${data.error || "Payload rejected."}` }]);
      }
    } catch (error) {
      setIsLoading(false);
      setIsAwaitingResponse(false);
      if (isSilentInjection) setIsInjecting(false);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "[System Error]: Network routing failure." }]);
    } 
  };

  const handleLawyerSelect = async (lawyerId: string, lawyerName: string) => {
    setIsInjecting(true);
    setIsLoading(true);
    const result = await assignLawyerToCase(activeCaseId, lawyerId);
    
    if (result.success) {
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: `[System]: Attorney ${lawyerName} has been officially secured for this case.` }]);
      await submitMessage(`[SYSTEM INSTRUCTION]: The user has officially retained Attorney ${lawyerName} (ID: ${lawyerId}). Acknowledge this choice professionally and state that you are preparing the final case matrix.`, true);
      window.dispatchEvent(new Event('refresh-case-data'));
    } else {
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: `[System Error]: ${result.error || "Failed to secure attorney in the database."}` }]);
      setIsInjecting(false);
      setIsLoading(false);
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
    <div className="relative h-175 w-full overflow-hidden bg-[#0c0c0e] text-zinc-200 font-sans flex flex-col rounded-2xl selection:bg-zinc-800 border border-zinc-800/60 shadow-2xl">
      
      <div className="border-b border-zinc-800/60 p-4 bg-[#08080a] flex justify-between items-center shrink-0 z-20">
        <div className="relative group">
          <select 
            value={activeCaseId}
            onChange={(e) => onSwitchCase(e.target.value)}
            className="appearance-none bg-[#0c0c0e] border border-zinc-800/80 text-zinc-300 text-[10px] font-mono py-2 pl-3 pr-8 rounded-lg cursor-pointer hover:border-zinc-700 focus:outline-none focus:border-emerald-500/50 max-w-62.5 truncate uppercase tracking-widest shadow-lg transition-all"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#08080a] text-zinc-300 py-2">
                {c.title || c.id.split('-')[0]}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500 group-hover:text-zinc-300 transition-colors">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isAgentLoading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{isAgentLoading ? "Processing" : "System Ready"}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
        
        {realtimeDegraded && <RealtimeDegradedBanner onRetry={retryRealtimeConnection} />}

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
                "Review this loan agreement for predatory banking clauses.", 
                "Analyze this eviction notice and check tenant rights.",
                "Extract a chronological timeline from these case files."
              ].map((prompt, i) => (
                <button key={i} onClick={() => submitMessage(prompt)} className="text-left p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/20 hover:bg-zinc-800/40 hover:border-zinc-700 transition-all text-xs text-zinc-400 hover:text-zinc-200 leading-relaxed">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <AnimatePresence>
          {messages.map((m) => {
            if (typeof m.content === "string" && m.content.includes("[DOCUMENT CONTENT extracted")) {
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center w-full my-4">
                  <div className="flex items-center gap-3 px-4 py-2 bg-emerald-950/20 border border-emerald-900/40 rounded-full text-[10px] font-mono text-emerald-500">
                    <CheckCircle2 className="w-3 h-3" />
                    Document Data Parsed & Injected into Matrix
                  </div>
                </motion.div>
              );
            }

            const isSystemMessage = typeof m.content === "string" && (m.content.startsWith("[System") || m.content.startsWith("[System Error]"));

            // TS FIX: By explicitly typing parsedLawyers, TS allows us to access .data
            const parsedLawyers: ParsedLawyerResult = m.structuredData
              ? (m.structuredData.matchFound
                  ? { type: "MATCH", data: m.structuredData.matches ?? [] }
                  : { type: "NO_MATCH", reason: m.structuredData.reason ?? "No available attorneys found for this specific criteria." })
              : (typeof m.content === "string" ? tryParseLawyerPayload(m.content) : null);

            if (parsedLawyers?.type === "MATCH") {
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start w-full my-4">
                  <LawyerSelectionCard lawyers={parsedLawyers.data} onSelect={handleLawyerSelect} isSelecting={isAgentLoading} />
                </motion.div>
              );
            }

            if (parsedLawyers?.type === "NO_MATCH") {
              return (
                <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start w-full my-4">
                  <div className="w-full max-w-sm bg-[#08080a] border border-amber-900/50 rounded-2xl p-5 shadow-2xl mt-2">
                    <div className="flex items-center gap-2 mb-2 text-amber-500">
                      <ShieldAlert className="w-4 h-4" />
                      <h3 className="text-sm font-medium tracking-wide">No Matches Found</h3>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{parsedLawyers.reason}</p>
                  </div>
                </motion.div>
              );
            }

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

            let displayContent = m.content;
            let hasAttachment = false;
            let attachmentName = "Document.pdf"; 

            if (typeof m.content === "string") {
              displayContent = displayContent.replace(/<scratchpad>[\s\S]*?<\/scratchpad>/gi, '').trim();
              displayContent = displayContent.replace(/```json[\s\S]*?```/gi, '').trim();
              
              const nameMatch = displayContent.match(/\[Attachment Name:\s*(.*?)\]/i);
              if (nameMatch && nameMatch[1]) {
                attachmentName = nameMatch[1].trim();
              }

              const legacyMatch = displayContent.match(/📎 Attached Document:\s*(.*)/i);
              if (legacyMatch && legacyMatch[1]) {
                attachmentName = legacyMatch[1].trim();
                hasAttachment = true;
                displayContent = displayContent.replace(/📎 Attached Document:.*?(\n|$)/gim, '').trim();
              }
              
              if (displayContent.includes("[Attached File URL:") || displayContent.includes("[Attachment Name:")) {
                hasAttachment = true;
                displayContent = displayContent.replace(/\[Attached File URL:.*?\]/gi, '').trim();
                displayContent = displayContent.replace(/\[Attachment Name:.*?\]/gi, '').trim();
              }
              
              displayContent = displayContent.replace(/\[STRICT SYSTEM INSTRUCTIONS\]:?[\s\S]*/gi, '').trim();
              displayContent = displayContent.replace(/\[SYSTEM INSTRUCTION\]:?[\s\S]*/gi, '').trim();
              displayContent = displayContent.replace(/\[SYSTEM INSTRUCTION:.*?\]/gi, '').trim();
            } else if (!m.structuredData) {
              return null;
            }

            if (typeof m.content === "string" && (displayContent.startsWith("[SYSTEM EVENT]"))) return null;
            if (!displayContent && !hasAttachment) return null;

            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex flex-col gap-1 max-w-[85%] sm:max-w-[75%] ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <span className="text-[9px] font-mono tracking-widest text-zinc-500 uppercase px-2">
                    {m.role === "user" ? "Client" : "LexiAssist"}
                  </span>

                  {hasAttachment && m.role === "user" && (
                    <div className="flex items-center gap-2 mb-1 px-3 py-2 bg-zinc-800/40 border border-zinc-700/50 rounded-xl text-[11px] font-mono text-zinc-300 shadow-sm backdrop-blur-sm">
                      <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className="truncate max-w-50">{attachmentName}</span>
                    </div>
                  )}
                  
                  {displayContent && (
                    <div className={`p-5 text-sm sm:text-[15px] leading-relaxed shadow-sm transition-all whitespace-pre-wrap wrap-break-word text-left
                      ${m.role === "user" 
                        ? "bg-zinc-800/80 border border-zinc-700/50 rounded-2xl rounded-tr-sm text-zinc-100" 
                        : "bg-[#08080a] border border-zinc-800/60 rounded-2xl rounded-tl-sm text-zinc-300"}`}
                    >
                      {typeof displayContent === "string" ? (
                        displayContent
                      ) : (
                        <div className="flex items-center gap-3 bg-zinc-900/50 border border-zinc-800/80 rounded-lg px-4 py-3 shadow-inner">
                          <Terminal className="w-4 h-4 text-emerald-500" />
                          <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                            Executing System Utility...
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          
          {isAwaitingResponse && <AgentExecutionLoader realTimeStep={currentStepText} />}
          
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 sm:p-6 pt-2 bg-[#08080a] shrink-0 border-t border-zinc-800/60 z-20">
        {attachedFile && (
          <div className="mb-3 px-3 py-1.5 bg-emerald-950/30 border border-emerald-900/50 rounded-md w-fit flex items-center gap-2 text-[10px] text-emerald-500 font-mono shadow-sm">
            <CheckCircle2 className="w-3 h-3" />
            {attachedFile.name} attached
            <button onClick={() => setAttachedFile(null)} className="ml-2 text-zinc-500 hover:text-rose-400 transition-colors">✕</button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-[#0c0c0e] border border-zinc-800/60 rounded-2xl p-2 transition-all focus-within:border-emerald-500/30 focus-within:bg-[#0c0c0e]/90 shadow-inner">
          <label className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl transition-colors cursor-pointer ${attachedFile ? 'bg-emerald-500/10 text-emerald-400' : 'bg-transparent text-zinc-400 hover:bg-zinc-800/80'} ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <input 
              type="file" 
              accept="application/pdf"
              className="hidden" 
              disabled={isUploading || isAgentLoading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                const res = await startUpload([file]);
                if (res && res[0]) {
                  const safeUrl = (res[0] as any).ufsUrl || res[0].url; 
                  
                  const dbRes = await saveDocumentRecord(safeUrl, activeCaseId);
                  
                  if (dbRes.success && dbRes.document) {
                    const docId = dbRes.document.id;
                    setAttachedFile({ url: safeUrl, name: res[0].name, id: docId });
                    setCurrentDocumentId(docId); 
                  } else {
                    setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "[System Error]: Failed to register document in database." }]);
                  }
                }
              }} 
            />
            {isUploading ? (
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
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
            placeholder={isAgentLoading ? "System processing..." : "Detail your legal situation..."}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isAgentLoading || !clientId || isUploading}
          />
          
          <button
            type="submit"
            disabled={isAgentLoading || (!input.trim() && !attachedFile) || !clientId || isUploading}
            className="shrink-0 h-11 w-11 flex items-center justify-center bg-zinc-200 hover:bg-white text-zinc-900 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}