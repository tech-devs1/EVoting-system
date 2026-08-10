'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { apiRequest } from '@/lib/api';
import { 
  Plus, 
  Trash2, 
  Users, 
  Layers, 
  Eye, 
  Upload, 
  Check, 
  Award,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface Position {
  id: string;
  title: string;
  maxChoices: number;
  isReferendum?: boolean;
  order: number;
}

interface Candidate {
  id: string;
  name: string;
  position: string;
  manifesto: string;
  photoUrl: string;
  votes: number;
  noVotes?: number;
  isIndependent?: boolean;
  ballotNumber?: string | number;
}

export default function PerElectionCandidatesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const electionId = resolvedParams.id;

  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);


  // Position Modal State
  const [isPosModalOpen, setIsPosModalOpen] = useState(false);
  const [posTitle, setPosTitle] = useState('');
  const [posMaxChoices, setPosMaxChoices] = useState(1);
  const [posIsReferendum, setPosIsReferendum] = useState(false);
  const [posSubmitting, setPosSubmitting] = useState(false);

  // Candidate Modal State
  const [isCandModalOpen, setIsCandModalOpen] = useState(false);
  const [candName, setCandName] = useState('');
  const [candPosition, setCandPosition] = useState('');
  const [candManifesto, setCandManifesto] = useState('');
  const [candPhotoUrl, setCandPhotoUrl] = useState('');
  const [candIsIndependent, setCandIsIndependent] = useState(false);
  const [candSubmitting, setCandSubmitting] = useState(false);

  // Live Ballot Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  async function fetchPositionsAndCandidates() {
    try {
      setLoading(true);
      
      const [posRes, candRes] = await Promise.all([
        apiRequest<{ status: string; data: Position[] }>(`/elections/${electionId}/positions`),
        apiRequest<{ status: string; data: Candidate[] }>(`/elections/${electionId}/candidates`)
      ]);

      if (posRes.status === 'success' && Array.isArray(posRes.data)) {
        setPositions(posRes.data);
        if (posRes.data.length > 0 && !candPosition) {
          setCandPosition(posRes.data[0].title);
        }
      }

      if (candRes.status === 'success' && Array.isArray(candRes.data)) {
        setCandidates(candRes.data);
      }
    } catch (err) {
      console.error('Error fetching positions/candidates:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (electionId) fetchPositionsAndCandidates();
  }, [electionId]);

  // Create Position Submit
  const handleCreatePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posTitle.trim()) return;
    setPosSubmitting(true);

    try {
      const payload = {
        title: posTitle.trim(),
        maxChoices: posMaxChoices,
        isReferendum: posIsReferendum,
        order: positions.length + 1
      };

      const res = await apiRequest<{ status: string; data: Position }>(`/elections/${electionId}/positions`, 'POST', payload);
      if (res.status === 'success' && res.data) {
        setPositions(prev => [...prev, res.data]);
        setPosTitle('');
        setPosMaxChoices(1);
        setPosIsReferendum(false);
        setIsPosModalOpen(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to create position.');
    } finally {
      setPosSubmitting(false);
    }
  };

  // Delete Position
  const handleDeletePosition = async (posId: string) => {
    if (!confirm('Are you sure you want to delete this position type?')) return;
    try {
      await apiRequest(`/elections/${electionId}/positions/${posId}`, 'DELETE');
      setPositions(prev => prev.filter(p => p.id !== posId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete position.');
    }
  };

  // Create Candidate Submit
  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candName.trim() || !candPosition) return;
    setCandSubmitting(true);

    try {
      const payload = {
        name: candName.trim(),
        position: candPosition,
        manifesto: candManifesto.trim(),
        photoUrl: candPhotoUrl.trim(),
        isIndependent: candIsIndependent
      };

      const res = await apiRequest<{ status: string; data: Candidate }>(`/elections/${electionId}/candidates`, 'POST', payload);
      if (res.status === 'success' && res.data) {
        setCandidates(prev => [...prev, res.data]);
        setCandName('');
        setCandManifesto('');
        setCandPhotoUrl('');
        setCandIsIndependent(false);
        setIsCandModalOpen(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add candidate.');
    } finally {
      setCandSubmitting(false);
    }
  };

  // Delete Candidate
  const handleDeleteCandidate = async (candId: string) => {
    if (!confirm('Are you sure you want to remove this candidate?')) return;
    try {
      await apiRequest(`/elections/${electionId}/candidates/${candId}`, 'DELETE');
      setCandidates(prev => prev.filter(c => c.id !== candId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove candidate.');
    }
  };

  // Group candidates strictly by Position Title
  const candidatesByPosition: Record<string, Candidate[]> = {};
  positions.forEach(pos => {
    candidatesByPosition[pos.title] = [];
  });
  candidates.forEach(cand => {
    const posName = cand.position || 'General';
    if (!candidatesByPosition[posName]) candidatesByPosition[posName] = [];
    candidatesByPosition[posName].push(cand);
  });

  return (
    <div className="animate-page-enter">
      {/* Workspace Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Positions & Candidates Builder
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
            Define position types, set selection rules, and organize candidates into position groups
          </p>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button onClick={() => setIsPosModalOpen(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
            <Plus size={16} /> Add Position Type
          </button>
          <button onClick={() => setIsCandModalOpen(true)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, backgroundColor: '#2563eb' }}>
            <Plus size={16} /> Register Candidate
          </button>
          <button onClick={() => setIsPreviewOpen(true)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Eye size={16} /> Live Ballot Preview
          </button>
        </div>
      </div>

      {/* Position Types Configured Bar */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.75rem', backgroundColor: 'var(--bg-card)' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={18} style={{ color: '#2563eb' }} /> Configured Position Types ({positions.length})
        </h3>
        
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {positions.map((pos) => (
            <div 
              key={pos.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                padding: '0.45rem 0.85rem',
                borderRadius: '10px',
                fontSize: '0.85rem'
              }}
            >
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pos.title}</span>
              <span className="badge badge-info" style={{ fontSize: '10px' }}>
                Select {pos.maxChoices}
              </span>
              {pos.isReferendum && (
                <span className="badge badge-warning" style={{ fontSize: '10px' }}>YES/NO</span>
              )}
              <button 
                onClick={() => handleDeletePosition(pos.id)}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0, marginLeft: '4px' }}
                title="Remove Position"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Candidates Grouped Strictly by Position Cards */}
      {loading ? (
        <p style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading position lineups...</p>
      ) : Object.keys(candidatesByPosition).length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No position types configured yet. Click "+ Add Position Type" to begin.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
          {Object.entries(candidatesByPosition).map(([posTitle, candList]) => {
            const posMeta = positions.find(p => p.title === posTitle);

            return (
              <div 
                key={posTitle}
                className="card"
                style={{ 
                  padding: '1.5rem',
                  borderRadius: '18px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)'
                }}
              >
                {/* Position Group Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700
                    }}>
                      <Award size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                        {posTitle}
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Voters select up to {posMeta?.maxChoices || 1} candidate{posMeta?.maxChoices !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <span className="badge badge-primary" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.3)' }}>
                    {candList.length} Candidate{candList.length !== 1 ? 's' : ''} Listed
                  </span>
                </div>

                {/* Candidate Cards Grid for THIS Position */}
                {candList.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-input)', borderRadius: '12px' }}>
                    No candidates registered under {posTitle} yet. Click "+ Register Candidate" above to add one.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
                    {candList.map((cand, idx) => (
                      <div 
                        key={cand.id}
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          borderRadius: '14px',
                          padding: '1.25rem',
                          border: '1px solid var(--border-color)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          position: 'relative'
                        }}
                      >
                        <div>
                          {/* Photo & Name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '0.85rem' }}>
                            <div style={{
                              width: '52px',
                              height: '52px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--border-color)',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '1.1rem',
                              border: '2px solid #2563eb'
                            }}>
                              {cand.photoUrl ? (
                                <img src={cand.photoUrl} alt={cand.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                cand.name.substring(0, 2).toUpperCase()
                              )}
                            </div>

                            <div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
                                Ballot #{idx + 1}
                              </span>
                              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '2px 0 0 0', color: 'var(--text-primary)' }}>
                                {cand.name}
                              </h4>
                            </div>
                          </div>

                          {/* Manifesto Snippet */}
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: '0 0 1rem 0' }}>
                            {cand.manifesto || 'No manifesto summary provided.'}
                          </p>
                        </div>

                        {/* Card Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                          <button
                            onClick={() => handleDeleteCandidate(cand.id)}
                            className="btn btn-outline"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Position Modal */}
      <Modal
        isOpen={isPosModalOpen}
        onClose={() => setIsPosModalOpen(false)}
        title="Add Custom Position Type"
      >
        <form onSubmit={handleCreatePosition} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.4rem', color: '#0F172A' }}>Position Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Financial Secretary"
              value={posTitle}
              onChange={(e) => setPosTitle(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.4rem', color: '#0F172A' }}>Max Candidate Choices Allowed</label>
            <select
              value={posMaxChoices}
              onChange={(e) => setPosMaxChoices(Number(e.target.value))}
            >
              <option value={1}>Select 1 (Single Winner / First-Past-The-Post)</option>
              <option value={2}>Select 2 (Top 2 Winners)</option>
              <option value={3}>Select 3 (Top 3 Winners)</option>
              <option value={4}>Select 4 (Top 4 Winners)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <input
              type="checkbox"
              id="referendum-check"
              checked={posIsReferendum}
              onChange={(e) => setPosIsReferendum(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <label htmlFor="referendum-check" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
              Enable YES / NO Referendum Mode for Unopposed Candidates
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsPosModalOpen(false)} style={{ padding: '0.7rem 1.25rem', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={posSubmitting} style={{ padding: '0.7rem 1.25rem', borderRadius: '14px', border: 'none', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
              {posSubmitting ? 'Saving Position...' : 'Save Position'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Candidate Modal */}
      <Modal
        isOpen={isCandModalOpen}
        onClose={() => setIsCandModalOpen(false)}
        title="Register Candidate"
      >
        <form onSubmit={handleCreateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.4rem', color: '#0F172A' }}>Full Candidate Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Kwame Mensah"
              value={candName}
              onChange={(e) => setCandName(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.4rem', color: '#0F172A' }}>Position Category *</label>
            <select
              required
              value={candPosition}
              onChange={(e) => setCandPosition(e.target.value)}
            >
              {positions.map(p => (
                <option key={p.id} value={p.title}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.4rem', color: '#0F172A' }}>Candidate Photo URL</label>
            <input
              type="url"
              placeholder="https://..."
              value={candPhotoUrl}
              onChange={(e) => setCandPhotoUrl(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.4rem', color: '#0F172A' }}>Manifesto & Bio Snippet</label>
            <textarea
              rows={3}
              placeholder="Brief campaign promise..."
              value={candManifesto}
              onChange={(e) => setCandManifesto(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={() => setIsCandModalOpen(false)} style={{ padding: '0.7rem 1.25rem', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={candSubmitting} style={{ padding: '0.7rem 1.25rem', borderRadius: '14px', border: 'none', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
              {candSubmitting ? 'Registering Candidate...' : 'Register Candidate'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Live Ballot Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title="📱 Live Voter Ballot Preview"
        subtitle="This is how voters will experience the ballot"
        maxWidth="640px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {Object.entries(candidatesByPosition).map(([posTitle, candList]) => (
            <div key={posTitle} style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.85rem 0', color: '#2563EB' }}>{posTitle}</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {candList.map(cand => (
                  <div key={cand.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#DBEAFE', color: '#1D4ED8', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                        {cand.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0F172A' }}>{cand.name}</span>
                    </div>
                    <input type="radio" name={posTitle} disabled style={{ width: '18px', height: '18px' }} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
