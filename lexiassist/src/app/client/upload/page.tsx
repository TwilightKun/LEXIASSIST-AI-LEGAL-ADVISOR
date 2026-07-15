// src/app/client/upload/page.tsx
"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { UploadDropzone } from "@/utils/uploadthing";
import { motion } from "framer-motion";
import Link from "next/link";
import { dispatchPdfToAgent } from "@/app/actions/document";

function SecureUploadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUploadComplete = async (res: any[]) => {
    if (!caseId) {
      setError("System Error: No Active Case Context found. Please return to the dashboard and try again.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    const fileUrl = res[0].url;

    // Trigger the Server Action which handles Prisma insertion and QStash dispatch
    const result = await dispatchPdfToAgent(fileUrl, caseId);

    if (result.success) {
      // Force a router refresh to ensure the dashboard grabs the latest DB state, then navigate
      router.refresh();
      router.push("/dashboard");
    } else {
      setError(result.error || "Failed to dispatch document to AI engine.");
      setIsProcessing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-2xl bg-[#0c0c0e] border border-zinc-800 rounded-3xl p-8 shadow-2xl relative"
    >
      {/* Header Section */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-medium text-zinc-100 uppercase tracking-wide">Upload Case Document</h1>
          <p className="text-sm font-mono text-zinc-500 mt-2">LexiAssist Secure Intake • PDF format only (Max 16MB)</p>
        </div>
        
        {/* Cancel/Back Button */}
        <Link 
          href="/dashboard"
          className="text-xs font-mono text-zinc-400 hover:text-zinc-200 uppercase tracking-widest px-4 py-2 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-colors"
        >
          Cancel
        </Link>
      </div>

      {/* UploadDropzone Component & Loading State */}
      <div className="border border-dashed border-zinc-700/50 rounded-2xl bg-zinc-900/30 p-4 transition-all focus-within:border-emerald-500/50 focus-within:bg-zinc-900/50">
        {!isProcessing ? (
          <UploadDropzone
            endpoint="pdfUploader"
            onClientUploadComplete={handleUploadComplete}
            onUploadError={(err: Error) => setError(`Upload failed: ${err.message}`)}
            appearance={{
              button: "bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-sm uppercase tracking-widest px-8 py-3 rounded-lg mt-4 ut-uploading:bg-emerald-900 ut-uploading:cursor-not-allowed after:bg-emerald-400",
              container: "p-12 focus-within:ring-0",
              label: "text-zinc-400 hover:text-zinc-300 transition-colors text-lg",
              allowedContent: "text-zinc-600 text-sm font-mono mt-2"
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="h-10 w-10 rounded-full border-2 border-emerald-500/20 border-t-emerald-500 animate-spin mb-6" />
            <p className="font-mono text-xs text-zinc-400 uppercase tracking-widest animate-pulse">
              Dispatching to QStash Engine...
            </p>
          </div>
        )}
      </div>

      {error && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 p-4 bg-rose-950/30 border border-rose-900/50 rounded-xl text-xs font-mono text-rose-400"
        >
          [System Alert]: {error}
        </motion.div>
      )}
    </motion.div>
  );
}

export default function DocumentUploadPage() {
  return (
    <div className="min-h-screen w-full bg-[#08080a] flex items-center justify-center p-4 sm:p-8 selection:bg-zinc-800">
      <Suspense fallback={
        <div className="flex items-center justify-center text-zinc-500 font-mono text-xs uppercase tracking-widest">
          Initializing Secure Vault...
        </div>
      }>
        <SecureUploadForm />
      </Suspense>
    </div>
  );
}