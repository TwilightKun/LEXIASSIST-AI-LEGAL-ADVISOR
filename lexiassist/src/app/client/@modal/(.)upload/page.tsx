"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { UploadDropzone } from "@/utils/uploadthing";
import { motion } from "framer-motion";
import { useTransition, useState, Suspense } from "react";
import { dispatchPdfToAgent } from "@/app/actions/document";

function ModalContent() {
  const router = useRouter();
  
  // 1. Grab the URL parameters to get the active case ID
  const searchParams = useSearchParams();
  const activeCaseId = searchParams.get("caseId") || "test-case-id";
  
  // 2. useTransition for Optimistic UI
  const [isPending, startTransition] = useTransition();
  const [isSuccess, setIsSuccess] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={() => router.back()} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-lg bg-[#0c0c0e] border border-zinc-800 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-medium text-zinc-100 uppercase tracking-wide">
              {isSuccess ? "Document Attached" : "Attach Document"}
            </h2>
            <p className="text-xs font-mono text-zinc-500 mt-1">PDF format only. Max 16MB.</p>
          </div>
          <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300 transition">✕</button>
        </div>

        <div className="border border-dashed border-zinc-700/50 rounded-xl bg-zinc-900/30 p-2 relative">
          
          {/* Optimistic UI Overlay - Shows instantly when DB starts saving */}
          {isPending && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900/80 backdrop-blur-sm rounded-xl">
               <div className="h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
               <p className="text-xs font-mono text-emerald-500 uppercase tracking-widest">Encrypting & Saving to Database...</p>
            </div>
          )}

          <UploadDropzone
            endpoint="pdfUploader"
            onClientUploadComplete={(res) => {
              const uploadedUrl = res[0].url;
              
              startTransition(async () => {
                const dbResult = await dispatchPdfToAgent(uploadedUrl, activeCaseId);
                
                if (dbResult.success) {
                  setIsSuccess(true);
                  // Refresh the router so the dashboard updates, then close modal
                  router.refresh();
                  setTimeout(() => router.back(), 1000); 
                } else {
                  alert("Upload succeeded, but database save failed.");
                }
              });
            }}
            onUploadError={(error: Error) => alert(`ERROR! ${error.message}`)}
            appearance={{
              button: "bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs uppercase tracking-widest px-4 py-2 rounded-md",
              container: "p-8 focus-within:ring-2 focus-within:ring-emerald-500/50",
              label: "text-zinc-400 hover:text-zinc-300 transition-colors",
              allowedContent: "text-zinc-600 text-xs font-mono mt-2"
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}

// Wrap in Suspense to prevent Next.js build errors when using useSearchParams
export default function UploadModal() {
  return (
    <Suspense fallback={null}>
      <ModalContent />
    </Suspense>
  );
}