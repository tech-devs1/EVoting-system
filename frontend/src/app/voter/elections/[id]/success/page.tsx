'use client';

import React, { use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Copy, Download, Search, AlertTriangle } from 'lucide-react';

export default function VoteSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const searchParams = useSearchParams();
  const verificationId = searchParams.get('verificationId');
  const resolvedParams = use(params);
  const electionId = resolvedParams.id;

  if (!verificationId) {
    return (
      <div className="empty-state" style={{ maxWidth: '500px', margin: '0 auto' }}>
        <AlertTriangle size={48} style={{ color: 'var(--color-danger)' }} />
        <h3>Invalid Session</h3>
        <p>No valid ballot validation receipts were returned during this browser session.</p>
        <Link href="/voter/dashboard" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
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
    const text = `VOTETRUST AI DIGITAL BALLOT RECEIPT\n==================================\nVerification ID: ${verificationId}\nStatus: HASH_VERIFIED\nTimestamp: ${new Date().toISOString()}\n==================================`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VoteTrust-Receipt-${verificationId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="confirm-box animate-page-enter" style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
      
      {/* Animated Checkmark Indicator */}
      <div className="success-checkmark" style={{ margin: '0 auto var(--space-6) auto' }}>
        <div className="check-icon"></div>
      </div>

      <h2 style={{ marginBottom: 'var(--space-2)' }}>Vote Cast Successfully!</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-8)' }}>
        Your ballot transaction has been processed and saved to the audit ledger.
      </p>

      {/* Digital Receipt Box */}
      <div className="receipt-box" style={{ 
        textAlign: 'left', 
        background: 'var(--bg-secondary)', 
        borderColor: 'var(--color-success)', 
        borderStyle: 'solid', 
        borderWidth: '1px',
        boxShadow: 'var(--shadow-glow-green)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: 'var(--space-6)'
      }}>
        <div style={{ 
          fontWeight: 'bold', 
          fontFamily: 'var(--font-body)', 
          fontSize: 'var(--text-xs)', 
          color: 'var(--color-success)', 
          textTransform: 'uppercase', 
          letterSpacing: 'var(--tracking-wide)', 
          marginBottom: 'var(--space-4)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--space-1.5)' 
        }}>
          <ShieldCheck size={14} /> Crypto Receipt Generated
        </div>
        <div className="receipt-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
          <span>Verification ID:</span>
          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{verificationId}</span>
        </div>
        <div className="receipt-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
          <span>Ledger Status:</span>
          <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>HASH_VERIFIED</span>
        </div>
        <div className="receipt-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
          <span>Timestamp:</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{new Date().toLocaleString()}</span>
        </div>
      </div>

      {/* Action Items Tools */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary btn-full btn-sm" onClick={handleCopyId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Copy size={14} /> Copy Verification ID
          </button>
          <button className="btn btn-secondary btn-full btn-sm" onClick={handleDownloadReceipt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Download size={14} /> Download Receipt
          </button>
        </div>
        <Link href={`/voter/verify?verificationId=${verificationId}`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <Search size={16} /> Verify on Audit Explorer
        </Link>
      </div>

      <Link href="/voter/dashboard" style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>
        Return to Dashboard Terminal
      </Link>
    </div>
  );
}
