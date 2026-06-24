'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Key, Search, ShieldCheck, Activity, EyeOff, ShieldAlert, AlertOctagon } from 'lucide-react';

interface AuditLog {
  electionId: string;
  timestamp: number;
  previousHash: string;
  currentHash: string;
  dataPayload: string;
}

export default function VoterVerifyPage() {
  const searchParams = useSearchParams();
  const initialId = searchParams.get('verificationId') || '';

  const [searchId, setSearchId] = useState(initialId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditLog | null>(null);
  const [electionTitle, setElectionTitle] = useState('');
  const [error, setError] = useState(false);
  const [searched, setSearched] = useState(false);

  const performSearch = async (id: string) => {
    if (!id || id.trim() === '') return;
    setLoading(true);
    setError(false);
    setResult(null);
    setElectionTitle('');
    setSearched(true);

    try {
      // Lookup the audit log entry by document ID from backend
      const res = await apiRequest<{ status: string; data: AuditLog }>(`/votes/verify/${id.trim()}`);
      if (res.status === 'success') {
        setResult(res.data);
        
        // Fetch election details for user clarity
        try {
          const elRes = await apiRequest<{ status: string; data: { title: string } }>(`/elections/${res.data.electionId}`);
          if (elRes.status === 'success') {
            setElectionTitle(elRes.data.title);
          }
        } catch {
          setElectionTitle('Student Election Instance');
        }
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Audit search error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialId) {
      setSearchId(initialId);
      performSearch(initialId);
    }
  }, [initialId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(searchId);
  };

  return (
    <div className="candidate-selection-container animate-page-enter">
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Vote Verification Hub</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Verify that your ballot transaction has been accurately cataloged on the digital audit log ledger without revealing candidate choices.
        </p>
      </div>

      {/* Search Input Card */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '250px', marginBottom: 0 }}>
            <label className="form-label" htmlFor="verify-input-id">Enter Cryptographic Verification ID</label>
            <div className="form-input-container">
              <Key size={18} className="form-input-icon" />
              <input 
                type="text" 
                id="verify-input-id" 
                className="form-input form-input-with-icon" 
                placeholder="e.g. VT-2026-AB12XY" 
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                required 
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '46px', display: 'flex', alignItems: 'center', gap: '6px' }} disabled={loading}>
            <Search size={18} /> {loading ? 'Looking up...' : 'Lookup Record'}
          </button>
        </form>
      </div>

      {/* Verification Results Box */}
      <div id="verification-result-container">
        {loading && <p style={{ color: 'var(--text-secondary)' }}>Searching ledger networks...</p>}
        
        {!loading && result && (
          <div className="card animate-fade-in" style={{ borderColor: 'var(--color-success)', borderWidth: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              <div>
                <span className="badge badge-success" style={{ fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={14} /> Recorded & Verified
                </span>
                <h3 style={{ fontSize: 'var(--text-xl)', marginTop: 'var(--space-2)' }}>{searchId}</h3>
              </div>
              <div className="countdown-timer" style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Activity size={14} /> Ledgers Verified
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Election Instance</span>
                <span style={{ fontWeight: 'bold', fontSize: 'var(--text-sm)' }}>{electionTitle}</span>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Verification Timestamp</span>
                <span style={{ fontWeight: 'bold', fontSize: 'var(--text-sm)' }}>{new Date(result.timestamp).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', display: 'block', marginBottom: 'var(--space-1)' }}>Ballot Choices Status</span>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: 'var(--text-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                  <EyeOff size={14} /> Hidden (Anonymized)
                </span>
              </div>
            </div>

            <div className="alert alert-info" style={{ marginBottom: 0, display: 'flex', gap: 'var(--space-3)' }}>
              <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Audit Integrity Certified</p>
                <p style={{ margin: 0, fontSize: 'var(--text-xs)' }}>
                  SHA-256 Block Hash: <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{result.currentHash}</code>. Previous Hash: <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{result.previousHash}</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && error && searched && (
          <div className="card text-center animate-fade-in" style={{ borderColor: 'var(--color-danger)' }}>
            <AlertOctagon size={48} style={{ color: 'var(--color-danger)', margin: '0 auto var(--space-3) auto' }} />
            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Audit Hash Mismatch</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', maxWidth: '400px', margin: '0 auto' }}>
              No matching ballot receipts fit that transaction verification ID on our ledger networks.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
