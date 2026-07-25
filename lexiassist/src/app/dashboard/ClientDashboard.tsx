// src/app/dashboard/ClientDashboard.tsx
"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createNewCase } from "@/lib/tools/actions/case";
import { getClientCaseDetails } from "@/app/actions/client"; 
import { getPusherClient } from "@/lib/pusher/client"; 
import { Loader2, Plus, Lock, Briefcase, AlertTriangle, DollarSign, Scale, ShieldCheck, CheckCircle2, Clock, MessageSquare, Video } from "lucide-react";
import ConsultationRoom from "./ConsultationRoom";
import { getOrInitializeConsultation } from "@/app/actions/consultation";

import ChatInterface from "./ChatInterface";
import RedlineViewer from "./RedlineViewer";
import ChronologyViewer from "./ChronologyViewer";
import DirectMessagePanel from "./DirectMessagePanel";

type CaseBrief = {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  rawDescription?: string;
  estimatedValue?: number | null;
  aiRiskAnalysis?: any | null; 
  lawyerId?: string | null;
};

export default function ClientDashboard({ initialCases }: { initialCases: CaseBrief[] }) {
  const router = useRouter(); 

  const [activeTab, setActiveTab] = useState<number>(1);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  
  const [cases, setCases] = useState<CaseBrief[]>(initialCases);
  const [activeCaseDetails, setActiveCaseDetails] = useState<any>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [isRoomActive, setIsRoomActive] = useState(false);
  const [roomData, setRoomData] = useState<{ id: string, webrtcRoomId: string } | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleTabClick = (tabIndex: number) => {
    if (tabIndex > 1 && !selectedCaseId) {
      setError("You must create or select a case matrix before accessing this workspace.");
      setTimeout(() => setError(null), 3000);
      return;
    }
    setActiveTab(tabIndex);
  };

  const handleCreateCase = () => {
    setError(null);
    startTransition(async () => {
      const result = await createNewCase("New Legal Inquiry");
      
      if (result.success && result.caseBrief) {
        setCases([result.caseBrief as CaseBrief, ...cases]);
        setSelectedCaseId(result.caseId);
        setActiveTab(3); 
      } else {
        setError(result.error || "System error during case initialization.");
      }
    });
  };

  const handleJoinRoom = async () => {
    if (!selectedCaseId) return;
    setIsJoining(true);

    const result = await getOrInitializeConsultation(selectedCaseId);

    if (result.success && result.consultation) {
      setRoomData({
        id: result.consultation.id,
        webrtcRoomId: result.consultation.webrtcRoomId
      });
      setIsRoomActive(true);
    }
    setIsJoining(false);
  };

  const fetchDetails = useCallback(async () => {
    if (!selectedCaseId) return;
    const result = await getClientCaseDetails(selectedCaseId);
    
    // Guard against missing properties and lock variable scope
    if (result.success && result.caseBrief) {
      const brief = result.caseBrief;
      
      setActiveCaseDetails(brief);
      setCases(prev => 
        prev.map(c => c.id === selectedCaseId ? { ...c, status: brief.status } : c)
      );
    }
  }, [selectedCaseId]);

  useEffect(() => {
    if (selectedCaseId) {
      setIsLoadingDetails(true);
      fetchDetails().finally(() => setIsLoadingDetails(false));
    }
  }, [selectedCaseId, fetchDetails]);

  // Listen for internal Local Event Bus
  useEffect(() => {
    const handleRefresh = () => fetchDetails();
    window.addEventListener('refresh-case-data', handleRefresh);
    return () => window.removeEventListener('refresh-case-data', handleRefresh);
  }, [fetchDetails]);

  // Optimistic State Injection via WebSockets
  useEffect(() => {
    if (!selectedCaseId) return;
    const pusher = getPusherClient();
    if (!pusher) return;

    const channelName = `case-${selectedCaseId}`;
    const channel = pusher.subscribe(channelName);

    channel.bind('status-update', (data: { status: string }) => {
      if (data && data.status) {
        // Force the React state to update instantly bypassing Next.js cache
        setActiveCaseDetails((prev: any) => prev ? { ...prev, status: data.status } : prev);
        setCases((prev) => prev.map(c => c.id === selectedCaseId ? { ...c, status: data.status } : c));
      }
      
      router.refresh(); // Purge Next.js client-side router cache
      fetchDetails();   // Run background sync just to be completely safe
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
    };
  }, [selectedCaseId, fetchDetails, router]);

  const pipeline = [
    { id: "TRIAGE", label: "AI Intake" },
    { id: "MATCHED", label: "Routing" },
    { id: "REVIEW", label: "Active Review" },
    { id: "RESOLVED", label: "Resolved" }
  ];
  const getStatusIndex = (status: string) => pipeline.findIndex(p => p.id === status);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200 p-4 sm:p-6 md:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/60 pb-5 overflow-x-auto scrollbar-none">
          {[
            { id: 1, label: "Case Portfolio" },
            { id: 2, label: "Status & Counsel" }, 
            { id: 3, label: "AI Intake Chat" },
            { id: 4, label: "Document Redlines" },
            { id: 5, label: "Case Chronology" },
          ].map((tab) => {
            const isLocked = tab.id > 1 && !selectedCaseId;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-mono uppercase tracking-widest transition-all shrink-0
                  ${isActive 
                    ? "bg-zinc-100 text-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.1)] font-bold" 
                    : "bg-[#0a0a0c] text-zinc-500 border border-zinc-800/60 hover:text-zinc-300 hover:bg-zinc-900/50"
                  }
                  ${isLocked ? "opacity-40 cursor-not-allowed hover:bg-[#0a0a0c] hover:text-zinc-500" : ""}
                `}
              >
                {tab.label} {isLocked && <Lock className="w-3 h-3" />}
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-rose-950/40 border border-rose-900/50 text-rose-400 p-4 rounded-xl text-xs font-mono flex items-center gap-3 shadow-lg">
              <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              [System Alert]: {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* TAB 1: CASE PORTFOLIO */}
        <div className={activeTab === 1 ? "block animate-in fade-in duration-300" : "hidden"}>
          <div className="space-y-6">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 bg-[#0a0a0c] border border-zinc-800/60 rounded-3xl shadow-sm">
              <div>
                <h2 className="text-2xl font-light text-zinc-100 tracking-wide">Active Case Files</h2>
                <p className="text-xs text-zinc-500 font-mono mt-1">// Select an existing file or initialize a new triage sequence.</p>
              </div>
              <button
                onClick={handleCreateCase}
                disabled={isPending}
                className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] shrink-0"
              >
                {isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Initializing...</>
                ) : (
                  <><Plus className="w-4 h-4" /> New Case</>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cases.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center border border-dashed border-zinc-800/60 rounded-3xl bg-[#0a0a0c]/50">
                  <Briefcase className="w-12 h-12 text-zinc-700 mb-4" />
                  <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">No active case briefs found.</p>
                </div>
              ) : (
                cases.map((caseItem) => {
                  const hasRisks = caseItem.aiRiskAnalysis && typeof caseItem.aiRiskAnalysis === 'object';
                  const riskFlags = hasRisks ? (caseItem.aiRiskAnalysis as any).primaryLegalRisks?.length || 0 : 0;
                  const valueString = caseItem.estimatedValue ? `$${caseItem.estimatedValue.toLocaleString()}` : null;
                  const isMatched = caseItem.status !== 'TRIAGE';

                  return (
                    <div 
                      key={caseItem.id}
                      onClick={() => {
                        setSelectedCaseId(caseItem.id);
                        setActiveTab(2); 
                      }}
                      className={`p-6 rounded-3xl border transition-all duration-300 cursor-pointer group flex flex-col justify-between min-h-45 relative overflow-hidden
                        ${selectedCaseId === caseItem.id 
                          ? "border-emerald-500/50 bg-emerald-950/10 shadow-[0_0_30px_rgba(16,185,129,0.05)]" 
                          : "border-zinc-800/60 bg-[#0a0a0c] hover:border-zinc-600 hover:bg-[#0c0c0e]"
                        }
                      `}
                    >
                      {selectedCaseId === caseItem.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]" />
                      )}

                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-zinc-200 font-medium tracking-wide truncate pr-4 text-lg">{caseItem.title}</h3>
                          <span className={`text-[9px] font-mono px-2.5 py-1 rounded-md border uppercase tracking-widest shrink-0
                            ${caseItem.status === 'MATCHED' ? 'bg-blue-950/30 text-blue-400 border-blue-900/50' : 
                              caseItem.status === 'REVIEW' ? 'bg-amber-950/30 text-amber-400 border-amber-900/50' : 
                              caseItem.status === 'RESOLVED' ? 'bg-emerald-950/30 text-emerald-400 border-emerald-900/50' : 
                              'bg-zinc-900 text-zinc-400 border-zinc-800'}
                          `}>
                            {caseItem.status}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-600 font-mono truncate uppercase tracking-widest">ID: {caseItem.id.split('-')[0]}</p>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        {isMatched && (
                          <div className="flex items-center gap-1 bg-blue-950/20 border border-blue-900/30 px-2 py-1 rounded text-[9px] font-mono text-blue-500 uppercase tracking-widest">
                            <Scale className="w-3 h-3" /> Counsel Assigned
                          </div>
                        )}
                        {valueString && (
                          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded text-[9px] font-mono text-zinc-400 uppercase tracking-widest">
                            <DollarSign className="w-3 h-3" /> Est: {valueString}
                          </div>
                        )}
                        {riskFlags > 0 && (
                          <div className="flex items-center gap-1 bg-rose-950/20 border border-rose-900/30 px-2 py-1 rounded text-[9px] font-mono text-rose-500 uppercase tracking-widest">
                            <AlertTriangle className="w-3 h-3" /> {riskFlags} Risks
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-6 border-t border-zinc-800/50 pt-4">
                        <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                          {new Date(caseItem.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-[10px] text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest font-bold flex items-center gap-1">
                          Track Status →
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {selectedCaseId && (
          <>
            {/* TAB 2: STATUS & COUNSEL (The Pipeline Tracker) */}
            <div className={activeTab === 2 ? "block animate-in fade-in duration-300" : "hidden"}>
              <div className="border border-zinc-800/60 bg-[#08080a] rounded-3xl min-h-125 shadow-2xl overflow-hidden p-6 sm:p-10">
                {isLoadingDetails ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-70 py-20">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                    <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Fetching assignment status...</p>
                  </div>
                ) : activeCaseDetails ? (
                  <div className="max-w-4xl mx-auto space-y-12">
                    
                    {/* Header */}
                    <div>
                      <h2 className="text-2xl font-light text-zinc-100 mb-2">{activeCaseDetails.title}</h2>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        ID: {activeCaseDetails.id}
                      </p>
                    </div>

                    {/* The Pipeline Tracker */}
                    <div className="relative pt-6 pb-4">
                      <div className="absolute top-11 left-8 right-8 h-0.5 bg-zinc-800/60 rounded-full" />
                      
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(getStatusIndex(activeCaseDetails.status) / (pipeline.length - 1)) * 100}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="absolute top-11 left-8 h-0.5 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                      />

                      <div className="relative flex justify-between">
                        {pipeline.map((step, idx) => {
                          const isActive = getStatusIndex(activeCaseDetails.status) >= idx;
                          const isCurrent = getStatusIndex(activeCaseDetails.status) === idx;
                          
                          return (
                            <div key={step.id} className="flex flex-col items-center w-1/4 group">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500 z-10 bg-[#08080a]
                                ${isActive ? "border-blue-500" : "border-zinc-800"}
                                ${isCurrent ? "shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-110" : ""}
                              `}>
                                {isActive ? <CheckCircle2 className="w-5 h-5 text-blue-500" /> : <Clock className="w-4 h-4 text-zinc-600" />}
                              </div>
                              <h4 className={`text-[10px] sm:text-xs font-bold uppercase tracking-wide mt-4 text-center transition-colors ${isActive ? "text-zinc-200" : "text-zinc-600"}`}>
                                {step.label}
                              </h4>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dynamic Counsel Card */}
                    <div className={`p-8 rounded-2xl border transition-all ${
                      activeCaseDetails.status === "REVIEW" || activeCaseDetails.status === "RESOLVED"
                        ? "border-blue-900/50 bg-blue-950/10" 
                        : "border-zinc-800/60 bg-zinc-900/20"
                    }`}>
                      <h3 className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mb-6">Verified Legal Representative</h3>
                      
                      {activeCaseDetails.lawyer ? (
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div>
                            <h4 className="text-xl font-medium text-zinc-100 flex items-center gap-2">
                              {activeCaseDetails.lawyer.user?.name || "Verified Attorney"}
                              <ShieldCheck className="w-5 h-5 text-emerald-500" />
                            </h4>
                            <p className="text-sm text-zinc-400 mt-1">
                              {activeCaseDetails.lawyer.experienceYrs} Years Experience • {activeCaseDetails.lawyer.jurisdiction} Jurisdiction
                            </p>
                          </div>

                          {/* Exact State matching logic */}
                          {activeCaseDetails.status === "REVIEW" ? (
                            <div className="flex flex-wrap gap-3">
                              <button 
                              onClick={() => setIsChatOpen(true)}
                              className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" /> Message
                              </button>
                              <button 
                                onClick={handleJoinRoom}
                                disabled={isJoining}
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
                              >
                                {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />} 
                                Join Room
                              </button>
                            </div>
                          ) : activeCaseDetails.status === "RESOLVED" ? (
                            <div className="px-5 py-3 border border-emerald-500/30 bg-emerald-500/10 rounded-xl text-emerald-500 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4" /> Mandate Resolved
                            </div>
                          ) : (
                            <div className="px-4 py-2.5 border border-amber-500/30 bg-amber-500/10 rounded-xl text-amber-500 text-[10px] font-mono uppercase tracking-widest flex items-center gap-2">
                              <Loader2 className="w-3 h-3 animate-spin" /> Awaiting Lawyer Acceptance
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 opacity-60">
                          <Scale className="w-8 h-8 mb-3 text-zinc-500" />
                          <p className="text-sm font-mono text-zinc-400 uppercase tracking-widest">Orchestrating Counsel Routing...</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* TAB 3: AI CHAT */}
            <div className={activeTab === 3 ? "block animate-in fade-in duration-300" : "hidden"}>
              <ChatInterface activeCaseId={selectedCaseId} cases={cases} onSwitchCase={setSelectedCaseId} />
            </div>

            {/* TAB 4: REDLINES */}
            <div className={activeTab === 4 ? "block animate-in fade-in duration-300" : "hidden"}>
              <div className="border border-zinc-800/60 bg-[#08080a] rounded-2xl h-175 shadow-2xl overflow-hidden">
                <RedlineViewer activeCaseId={selectedCaseId} />
              </div>
            </div>

            {/* TAB 5: CHRONOLOGY */}
            <div className={activeTab === 5 ? "block animate-in fade-in duration-300" : "hidden"}>
               <div className="border border-zinc-800/60 bg-[#08080a] rounded-2xl h-175 shadow-2xl overflow-hidden">
                <ChronologyViewer activeCaseId={selectedCaseId} />
              </div>
            </div>
          </>
        )}

      </div>
      
      {/* Launch Secure WebRTC Bridge */}
      <AnimatePresence>
        {isRoomActive && roomData && selectedCaseId && (
          <ConsultationRoom 
            caseId={selectedCaseId}
            consultationId={roomData.id}
            webrtcRoomId={roomData.webrtcRoomId}
            isLawyer={false} 
            onLeave={() => setIsRoomActive(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Launch Direct Messaging Panel */}
      {selectedCaseId && activeCaseDetails?.lawyer && (
        <DirectMessagePanel 
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          caseBriefId={selectedCaseId}
          chatPartnerName={activeCaseDetails.lawyer.user?.name || "Attorney"}
        />
      )}
    </div>
  );
}