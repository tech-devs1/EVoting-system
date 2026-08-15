'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Copy, Download, AlertTriangle, ArrowLeft, Check } from 'lucide-react';

function VoteSuccessContent() {
  const searchParams = useSearchParams();
  const verificationId = searchParams.get('verificationId');
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

  if (!verificationId) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center max-w-md mx-auto shadow-sm">
        <AlertTriangle size={48} className="text-red-500 mx-auto mb-3" />
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Invalid Session</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">No valid ballot validation receipts were returned during this browser session.</p>
        <Link href="/voter/dashboard" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(verificationId);
    alert('Verification ID copied to clipboard!');
  };

  const handleDownloadReceipt = () => {
    const text = `COMPSSA ✓ DIGITAL BALLOT RECEIPT\n==================================\nVerification ID: ${verificationId}\nStatus: HASH_VERIFIED\nTimestamp: ${new Date().toISOString()}\n==================================`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `COMPSSA-Receipt-${verificationId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-md mx-auto text-center flex flex-col gap-6 pt-4">
      <div>
        <Link href="/voter/dashboard" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-4">
          <ArrowLeft size={14} /> Return to Dashboard
        </Link>
      </div>
      
      {/* Animated Checkmark Indicator */}
      <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
        <Check size={32} />
      </div>

      <div>
        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">Vote Cast Successfully!</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Your ballot transaction has been processed and saved to the audit ledger.
        </p>
      </div>

      {/* Digital Receipt Box */}
      <div className="bg-white dark:bg-slate-800 border-2 border-emerald-500 rounded-3xl p-6 text-left shadow-lg shadow-emerald-500/10 flex flex-col gap-3">
        <div className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-700/60">
          <ShieldCheck size={14} /> Crypto Receipt Generated
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Verification ID:</span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">{verificationId}</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Ledger Status:</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">HASH_VERIFIED</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Timestamp:</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">{new Date().toLocaleString()}</span>
        </div>
      </div>

      {/* Action Items Tools */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <button 
            className="py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-center gap-1.5" 
            onClick={handleCopyId}
          >
            <Copy size={14} /> Copy ID
          </button>
          <button 
            className="py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-center gap-1.5" 
            onClick={handleDownloadReceipt}
          >
            <Download size={14} /> Download Receipt
          </button>
        </div>
      </div>

      <Link href="/voter/dashboard" className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">
        Return to Dashboard Terminal
      </Link>
    </div>
  );
}

export default function VoteSuccessPage() {
  return (
    <Suspense fallback={<p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading receipt...</p>}>
      <VoteSuccessContent />
    </Suspense>
  );
}
