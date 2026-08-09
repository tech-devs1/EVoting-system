'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, 
  Upload, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  Mail, 
  Check, 
  Clock, 
  FileText 
} from 'lucide-react';

interface Voter {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone?: string;
  isRegistered?: boolean;
  hasVoted?: boolean;
}

export default function PerElectionVotersPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const electionId = resolvedParams.id;

  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // CSV Upload State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvStats, setCsvStats] = useState({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function fetchRosterVoters() {
    try {
      setLoading(true);
      const res = await apiRequest<{ status: string; data: Voter[] }>(`/elections/${electionId}/voters`);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setVoters(res.data);
      }
    } catch (err) {
      console.error('Error fetching election voters:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (electionId) fetchRosterVoters();
  }, [electionId]);

  // Handle File Change & Pre-Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length === 0) return;

      const rows = lines.slice(1);
      let validCount = 0;
      let duplicateCount = 0;
      let invalidCount = 0;
      const seen = new Set<string>();
      const parsedPreview: any[] = [];

      rows.forEach((row, idx) => {
        const cols = row.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length >= 2) {
          const indexNum = cols[0];
          const name = cols[1] || '';
          const email = cols[2] || '';
          const phone = cols[3] || '';

          const isValidEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

          if (!isValidEmail) {
            invalidCount++;
          } else if (seen.has(indexNum.toLowerCase())) {
            duplicateCount++;
          } else {
            seen.add(indexNum.toLowerCase());
            validCount++;
          }

          if (idx < 10) {
            parsedPreview.push({ indexNum, name, email, phone });
          }
        }
      });

      setCsvStats({
        total: rows.length,
        valid: validCount,
        duplicates: duplicateCount,
        invalid: invalidCount
      });
      setCsvPreview(parsedPreview);
    };
    reader.readAsText(file);
  };

  // Submit CSV Roster to Server
  const handleUploadRoster = async () => {
    if (!csvFile) return;
    setUploading(true);
    setUploadMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', csvFile);

      const res = await fetch(`/api/elections/${electionId}/upload-roster`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setUploadMessage({ type: 'success', text: `Roster saved! Added ${data.insertedCount || csvStats.valid} eligible voters to this election.` });
        setCsvFile(null);
        setCsvPreview([]);
        setCsvStats({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
        fetchRosterVoters();
      } else {
        throw new Error(data.message || 'Failed to upload roster.');
      }
    } catch (err: any) {
      setUploadMessage({ type: 'error', text: err.message || 'Failed to process CSV file.' });
    } finally {
      setUploading(false);
    }
  };

  const filteredVoters = voters.filter(v => {
    const matchesSearch = v.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'voted') return matchesSearch && v.hasVoted;
    if (statusFilter === 'pending') return matchesSearch && !v.hasVoted;
    return matchesSearch;
  });

  return (
    <div className="animate-page-enter">
      {/* Banner */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link href={`/admin/elections/${electionId}/dashboard`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-primary)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginBottom: '0.75rem' }}>
          <ArrowLeft size={16} /> Back to Election Command Center
        </Link>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
          Election Voter Roster
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
          Manage eligible voters and upload CSV rosters exclusively for this election
        </p>
      </div>

      {/* CSV Roster Upload Section */}
      <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Upload size={18} style={{ color: 'var(--color-primary)' }} />
          Upload Election Voter Roster (CSV)
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem 0' }}>
          Upload a CSV file containing eligible voters for this election. Required columns: <strong>IndexNumber, FullName, EmailAddress, Phone</strong>.
        </p>

        {uploadMessage && (
          <div style={{
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            marginBottom: '1.25rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            backgroundColor: uploadMessage.type === 'success' ? '#f0fdf4' : '#fef2f2',
            color: uploadMessage.type === 'success' ? '#166534' : '#dc2626',
            border: `1px solid ${uploadMessage.type === 'success' ? '#bbf7d0' : '#fecaca'}`
          }}>
            {uploadMessage.text}
          </div>
        )}

        <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--bg-input)' }}>
          <input type="file" accept=".csv" onChange={handleFileChange} style={{ fontSize: '0.9rem' }} />
        </div>

        {/* Live CSV Pre-Validation Box */}
        {csvStats.total > 0 && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <span className="badge badge-success">✓ {csvStats.valid} Valid Voters</span>
              <span className="badge badge-warning">⚠ {csvStats.duplicates} Duplicates</span>
              <span className="badge badge-danger">❌ {csvStats.invalid} Invalid Emails</span>
            </div>

            <h4 style={{ fontSize: '0.85rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>Live Roster Preview (First 10 Rows)</h4>
            <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-input)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 12px' }}>Index No</th>
                    <th style={{ padding: '6px 12px' }}>Name</th>
                    <th style={{ padding: '6px 12px' }}>Email</th>
                    <th style={{ padding: '6px 12px' }}>Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {csvPreview.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{row.indexNum}</td>
                      <td style={{ padding: '6px 12px' }}>{row.name}</td>
                      <td style={{ padding: '6px 12px' }}>{row.email}</td>
                      <td style={{ padding: '6px 12px' }}>{row.phone || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleUploadRoster}
              disabled={uploading || csvStats.valid === 0}
              className="btn btn-primary"
              style={{ fontWeight: 700 }}
            >
              {uploading ? 'Processing & Saving Roster...' : `Save ${csvStats.valid} Eligible Voters to Election`}
            </button>
          </div>
        )}
      </div>

      {/* Eligible Voter Directory Table */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Eligible Voters Directory</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Total Roster: {voters.length} voters</p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search voter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', backgroundColor: 'var(--bg-input)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                onClick={() => setStatusFilter('all')}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: statusFilter === 'all' ? 'var(--color-primary)' : 'var(--bg-input)', color: statusFilter === 'all' ? '#fff' : 'var(--text-secondary)' }}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('voted')}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: statusFilter === 'voted' ? 'var(--color-primary)' : 'var(--bg-input)', color: statusFilter === 'voted' ? '#fff' : 'var(--text-secondary)' }}
              >
                Voted
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: statusFilter === 'pending' ? 'var(--color-primary)' : 'var(--bg-input)', color: statusFilter === 'pending' ? '#fff' : 'var(--text-secondary)' }}
              >
                Pending
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>Loading eligible voters...</p>
        ) : filteredVoters.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No voters found for this election.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-input)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Index Number</th>
                  <th style={{ padding: '10px 14px' }}>Full Name</th>
                  <th style={{ padding: '10px 14px' }}>Email Address</th>
                  <th style={{ padding: '10px 14px' }}>Phone</th>
                  <th style={{ padding: '10px 14px' }}>Voting Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredVoters.map((v, i) => (
                  <tr key={v.id || i} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600 }}>{v.studentId}</td>
                    <td style={{ padding: '10px 14px' }}>{v.name}</td>
                    <td style={{ padding: '10px 14px' }}>{v.email}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{v.phone || 'N/A'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {v.hasVoted ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={12} /> Ballot Cast
                        </span>
                      ) : (
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
