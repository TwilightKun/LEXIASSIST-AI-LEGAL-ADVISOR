"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, ShieldCheck, Loader2 } from "lucide-react";
import { markConsultationComplete } from "@/app/actions/consultation";
import { getPusherClient } from "@/lib/pusher/client";

interface ConsultationRoomProps {
  caseId: string;
  consultationId: string;
  webrtcRoomId: string;
  onLeave: () => void;
  isLawyer: boolean;
}

export default function ConsultationRoom({ caseId, consultationId, webrtcRoomId, onLeave, isLawyer }: ConsultationRoomProps) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const hasInitialized = useRef(false);
  
  // WebRTC Race Condition Buffer (ICE Candidates)
  const pendingIceCandidates = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initWebRTC = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        peerConnection.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
            setIsConnecting(false); 
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendSignal('candidate', event.candidate);
          }
        };

        const flushIceCandidates = async () => {
          for (const candidate of pendingIceCandidates.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
          }
          pendingIceCandidates.current = [];
        };

        // Helper to prevent the "Double-Trigger" offer collision
        const initiateCall = async () => {
          if (pc.signalingState !== 'stable') return; // Already negotiating!
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal('offer', offer);
        };

        const pusher = getPusherClient();
        if (!pusher) return;
        const channel = pusher.subscribe(`room-${webrtcRoomId}`);
        
        channel.bind('webrtc-signal', async (data: any) => {
          if (data.sender === (isLawyer ? 'lawyer' : 'client')) return;

          if (data.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
            await flushIceCandidates(); 
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal('answer', answer);
            
          } else if (data.type === 'answer') {
            // FIX: Prevent crashing if an answer arrives while already connected
            if (pc.signalingState !== 'have-local-offer') {
              console.warn("Ignored redundant answer. Current state:", pc.signalingState);
              return; 
            }
            await pc.setRemoteDescription(new RTCSessionDescription(data.payload));
            await flushIceCandidates(); 
            
          } else if (data.type === 'candidate') {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(data.payload)).catch(console.error);
            } else {
              pendingIceCandidates.current.push(data.payload);
            }
            
          } else if (data.type === 'join') {
            if (isLawyer) {
              await initiateCall();
            } else {
              sendSignal('client-ready', null);
            }
            
          } else if (data.type === 'client-ready') {
            if (isLawyer) {
              await initiateCall();
            }
          }
        });

        sendSignal('join', null);

      } catch (err) {
        console.error("WebRTC Setup Failed:", err);
        alert("Failed to access camera/microphone.");
      }
    };

    let pc: RTCPeerConnection;
    initWebRTC();

    return () => {
      if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
      if (peerConnection.current) peerConnection.current.close();
      const pusher = getPusherClient();
      if (pusher) pusher.unsubscribe(`room-${webrtcRoomId}`);
    };
  }, [webrtcRoomId, isLawyer]);

  const sendSignal = async (type: string, payload: any) => {
    await fetch('/api/webrtc/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room: webrtcRoomId,
        type,
        payload,
        sender: isLawyer ? 'lawyer' : 'client'
      })
    });
  };

  useEffect(() => {
    if (localStream.current) {
      localStream.current.getAudioTracks().forEach(t => t.enabled = isMicOn);
      localStream.current.getVideoTracks().forEach(t => t.enabled = isVideoOn);
    }
  }, [isMicOn, isVideoOn]);

  const handleEndCall = async () => {
    if (isLawyer) {
      await markConsultationComplete(consultationId, caseId);
      window.dispatchEvent(new Event('refresh-case-data'));
    }
    onLeave();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8"
    >
      <div className="w-full max-w-6xl h-[85vh] bg-[#0c0c0e] rounded-3xl border border-zinc-800/80 shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* Top Header */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 bg-linear-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950/50 border border-emerald-900/50 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-zinc-100 font-medium tracking-wide">Secure Legal Consultation</h3>
              <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> E2E Encrypted Bridge
              </p>
            </div>
          </div>
        </div>

        {/* Video Grid */}
        <div className="flex-1 p-6 pt-24 flex gap-6">
          {/* Main Peer Video */}
          <div className="flex-1 bg-[#050505] rounded-2xl border border-zinc-800/60 overflow-hidden relative flex items-center justify-center shadow-inner">
            {isConnecting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-60 z-10 bg-zinc-900">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest">Awaiting Peer Connection...</p>
              </div>
            )}
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1.5 rounded-md backdrop-blur-md border border-white/10 text-xs font-mono text-white z-10">
              {isLawyer ? "Client" : "Verified Attorney"}
            </div>
          </div>

          {/* Local Self Video */}
          <div className="w-72 bg-zinc-900 rounded-2xl border border-zinc-700/50 overflow-hidden relative flex items-center justify-center shadow-2xl self-end h-48">
             <video 
               ref={localVideoRef} 
               autoPlay playsInline muted 
               className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoOn ? "opacity-100" : "opacity-0"}`}
               style={{ transform: "scaleX(-1)" }}
             />
             {!isVideoOn && (
               <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                 <VideoOff className="w-6 h-6 text-zinc-500" />
               </div>
             )}
            <div className="absolute bottom-3 left-3 bg-black/60 px-2 py-1 rounded backdrop-blur-md border border-white/10 text-[10px] font-mono text-zinc-300 z-10">
              You ({isLawyer ? "Counsel" : "Client"})
            </div>
          </div>
        </div>

        {/* Hardware Controls */}
        <div className="h-24 bg-[#08080a] border-t border-zinc-800/60 flex items-center justify-center gap-6 shrink-0 z-20">
          <button onClick={() => setIsMicOn(!isMicOn)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isMicOn ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200" : "bg-rose-500/20 text-rose-500 border border-rose-500/50"}`}>
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsVideoOn(!isVideoOn)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isVideoOn ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200" : "bg-rose-500/20 text-rose-500 border border-rose-500/50"}`}>
            {isVideoOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
          <button onClick={handleEndCall} className="w-16 h-12 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center transition-all shadow-lg shadow-rose-900/20 px-8 ml-4 gap-2">
            <PhoneOff className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">{isLawyer ? "Resolve Matrix" : "Leave"}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}