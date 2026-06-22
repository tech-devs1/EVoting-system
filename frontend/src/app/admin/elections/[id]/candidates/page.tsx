'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { Plus, ArrowLeft, Trash, AlertTriangle, Users } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  manifesto: string;
  photoUrl: string;
  votes: number;
}

interface Election {
  id: string;
  title: string;
}

export default function AdminElectionCandidatesPage({ params }: { params: Promise<{ id: string }> }) {
  const [electionId, setElectionId] = React.useState<string>('');
  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPos, setFormPos] = useState('');
  const [formManifesto, setFormManifesto] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Unwrap params
  React.useEffect(() => {
    params.then(p => setElectionId(p.id));
  }, [params]);

  useEffect(() => {
    if (!electionId) return;
    async function fetchData() {
      try {
        const elRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
        if (elRes.status === 'success') setElection(elRes.data);

        const candRes = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`);
        if (candRes.status === 'success') setCandidates(candRes.data);
      } catch (err) {
        console.error('Error loading candidates:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [electionId]);

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest<{ status: string; data: Candidate }>('/candidates', 'POST', {
        name: formName,
        position: formPos,
        manifesto: formManifesto,
        electionId
      });
      if (res.status === 'success') {
        setCandidates(prev => [...prev, res.data]);
        setIsModalOpen(false);
        setFormName(''); setFormPos(''); setFormManifesto('');
      }
    } catch (err) {
      console.error('Error adding candidate:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p style={{ color: 'var(--text-secondary)' }}>Loading candidate directory...</p>;

  return (
    <div className="animate-page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <Link href="/admin/elections" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={14} /> Return to Elections
          </Link>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>{election?.title || 'Election'} — Candidates Directory</h2>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={16} /> Add Candidate
        </button>
      </div>

      {/* Candidate Grid */}
      <div className="candidate-grid">
        {candidates.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <Users size={48} style={{ color: 'var(--text-tertiary)' }} />
            <h3>No Candidates</h3>
            <p>No candidate entries exist for this ballot. Tap Add Candidate above to get started.</p>
          </div>
        ) : (
          candidates.map(cand => (
            <div className="card candidate-card" key={cand.id}>
              <img
                src={cand.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'}
                alt={cand.name}
                className="candidate-photo"
              />
              <h4 className="candidate-name">{cand.name}</h4>
              <span className="candidate-position">{cand.position}</span>
              <p className="candidate-manifesto line-clamp-3" style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-xs)' }}>
                {cand.manifesto}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  Votes: <strong style={{ color: 'var(--text-primary)' }}>{cand.votes || 0}</strong>
                </span>
              </div>
              <button
                className="btn btn-sm btn-full"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => setCandidates(prev => prev.filter(c => c.id !== cand.id))}
              >
                <Trash size={14} /> Remove Candidate
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Candidate Modal */}
      {isModalOpen && (
        <div className="modal-overlay active" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Candidate Profile</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddCandidate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="cand-name">Candidate Name</label>
                  <input type="text" id="cand-name" className="form-input" placeholder="e.g. John Doe" required value={formName} onChange={e => setFormName(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                  <label className="form-label" htmlFor="cand-pos">Position</label>
                  <input type="text" id="cand-pos" className="form-input" placeholder="e.g. President" required value={formPos} onChange={e => setFormPos(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                  <label className="form-label" htmlFor="cand-man">Manifesto</label>
                  <textarea id="cand-man" className="form-input" placeholder="Enter manifesto text details..." style={{ minHeight: '80px' }} required value={formManifesto} onChange={e => setFormManifesto(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Candidate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
