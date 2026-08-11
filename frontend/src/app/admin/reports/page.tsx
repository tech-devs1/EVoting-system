'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import {
  FileText,
  Download,
  Calendar,
  Vote,
  CheckCircle2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

interface Election {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  type?: string;
  department?: string;
}

export default function AdminReportsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const fetchElections = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
      if (res.status === 'success' && Array.isArray(res.data)) {
        setElections(res.data);
      }
    } catch (err: any) {
      console.error('Error fetching elections:', err);
      setError('Failed to fetch elections list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElections();
  }, []);

  const handleDownloadPDF = async (electionId: string, title: string) => {
    setDownloadingId(electionId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/elections/${electionId}/report/pdf`, {
        headers
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_results.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Failed to export PDF report:', err);
      alert('Failed to generate results PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportAudit = async (electionId: string, title: string) => {
    setExportingId(electionId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/elections/${electionId}/export-audit`, {
        headers
      });
      if (!res.ok) throw new Error('Failed to export ledger CSV');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_ledger_audit.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Failed to export audit ledger:', err);
      alert('Failed to download audit ledger CSV.');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="admin-container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Certified Election Reports
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Download official certified results PDF documents and cryptographic voter verification ledgers.
          </p>
        </div>
        <button
          onClick={fetchElections}
          disabled={loading}
          className="btn btn-outline"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem',
          borderRadius: '10px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          marginBottom: '1.5rem',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading && elections.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto 1rem auto' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Loading election lists...</p>
        </div>
      ) : elections.length === 0 ? (
        <div className="card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <FileText size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Elections Available</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto' }}>
            There are no elections in the database. Head over to the elections tab to create a new one.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
          {elections.map((election) => (
            <div
              key={election.id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.5rem',
                flexWrap: 'wrap',
                gap: '1.5rem',
                borderLeft: `4px solid ${
                  election.status === 'completed' ? '#10B981' : election.status === 'active' ? '#3B82F6' : '#94A3B8'
                }`
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {election.title}
                  </h3>
                  <span
                    className={`badge ${
                      election.status === 'completed'
                        ? 'badge-success'
                        : election.status === 'active'
                        ? 'badge-primary'
                        : 'badge-secondary'
                    }`}
                  >
                    {election.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={12} />
                    <span>
                      {new Date(election.startDate).toLocaleString()} - {new Date(election.endDate).toLocaleString()}
                    </span>
                  </div>
                  {election.type && <span>• {election.type}</span>}
                  {election.department && <span>• {election.department}</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleDownloadPDF(election.id, election.title)}
                  disabled={downloadingId !== null || exportingId !== null}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <Download size={14} />
                  {downloadingId === election.id ? 'Generating PDF...' : 'Download Results PDF'}
                </button>
                <button
                  onClick={() => handleExportAudit(election.id, election.title)}
                  disabled={downloadingId !== null || exportingId !== null}
                  className="btn btn-outline"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700 }}
                >
                  <FileText size={14} />
                  {exportingId === election.id ? 'Exporting CSV...' : 'Audit Ledger CSV'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
