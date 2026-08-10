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
  Pencil,
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

const compressImageFile = (file: File, maxWidth = 300, maxHeight = 300, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve((reader.result as string) || '');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve((reader.result as string) || '');
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
};

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
  const [candBallotNumber, setCandBallotNumber] = useState<number>(1);
  const [candManifesto, setCandManifesto] = useState('');
  const [candPhotoUrl, setCandPhotoUrl] = useState('');
  const [candImagePreview, setCandImagePreview] = useState('');
  const [candIsIndependent, setCandIsIndependent] = useState(false);
  const [candSubmitting, setCandSubmitting] = useState(false);

  // Edit Candidate Modal State
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editBallotNumber, setEditBallotNumber] = useState<number>(1);
  const [editManifesto, setEditManifesto] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editImagePreview, setEditImagePreview] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Form Style Constants
  const mInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.85rem 1.1rem',
    borderRadius: '14px',
    border: '1.5px solid #CBD5E1',
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: '0.95rem',
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
  };

  const mSelectStyle: React.CSSProperties = {
    ...mInputStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2523475569' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 1rem center',
    backgroundSize: '1.25rem',
    paddingRight: '2.5rem',
    cursor: 'pointer',
  };

  const mLabelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 700,
    marginBottom: '0.45rem',
    color: '#0F172A',
    letterSpacing: '-0.01em',
  };

  // Live Ballot Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  async function fetchPositionsAndCandidates() {
    try {
      setLoading(true);
      
      const [posRes, candRes] = await Promise.all([
        apiRequest<{ status: string; data: Position[] }>(`/elections/${electionId}/positions`),
        apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`)
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
        isIndependent: candIsIndependent,
        ballotNumber: Number(candBallotNumber) || 1,
        electionId
      };

      const res = await apiRequest<{ status: string; data: Candidate }>(`/candidates`, 'POST', payload);
      if (res.status === 'success' && res.data) {
        setCandidates(prev => [...prev, res.data]);
        setCandName('');
        setCandManifesto('');
        setCandPhotoUrl('');
        setCandImagePreview('');
        setCandIsIndependent(false);
        setIsCandModalOpen(false);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to add candidate.');
    } finally {
      setCandSubmitting(false);
    }
  };

  // Open Edit Candidate Modal
  const openEditCandidateModal = (cand: Candidate) => {
    setEditingCandidate(cand);
    setEditName(cand.name);
    setEditPosition(cand.position);
    setEditBallotNumber(cand.ballotNumber ? Number(cand.ballotNumber) : 1);
    setEditManifesto(cand.manifesto || '');
    setEditPhotoUrl(cand.photoUrl || '');
    setEditImagePreview(cand.photoUrl || '');
  };

  // Update Candidate Submit
  const handleUpdateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate || !editName.trim() || !editPosition) return;
    setEditSubmitting(true);

    try {
      const payload = {
        name: editName.trim(),
        position: editPosition,
        manifesto: editManifesto.trim(),
        photoUrl: editPhotoUrl.trim(),
        ballotNumber: Number(editBallotNumber) || 1
      };

      const res = await apiRequest<{ status: string }>(`/candidates/${editingCandidate.id}`, 'PATCH', payload);
      if (res.status === 'success') {
        setCandidates(prev => prev.map(c => c.id === editingCandidate.id ? { ...c, ...payload } : c));
        setEditingCandidate(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update candidate.');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Update Ballot Number directly
  const handleUpdateBallotNumber = async (candId: string, newBallotNo: number) => {
    const num = Math.max(1, newBallotNo);
    setCandidates(prev => prev.map(c => c.id === candId ? { ...c, ballotNumber: num } : c));
    try {
      await apiRequest(`/candidates/${candId}`, 'PATCH', { ballotNumber: num });
    } catch (err: any) {
      console.error('Failed to update ballot number:', err);
    }
  };

  // Delete Candidate
  const handleDeleteCandidate = async (candId: string) => {
    if (!confirm('Are you sure you want to remove this candidate?')) return;
    try {
      await apiRequest(`/candidates/${candId}`, 'DELETE');
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

  // Sort candidates within each position strictly by ballotNumber (ascending)
  Object.keys(candidatesByPosition).forEach(posTitle => {
    candidatesByPosition[posTitle].sort((a, b) => {
      const numA = a.ballotNumber !== undefined && a.ballotNumber !== null && a.ballotNumber !== '' ? Number(a.ballotNumber) : 999;
      const numB = b.ballotNumber !== undefined && b.ballotNumber !== null && b.ballotNumber !== '' ? Number(b.ballotNumber) : 999;
      if (numA !== numB) return numA - numB;
      return (a.name || '').localeCompare(b.name || '');
    });
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

                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2px' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#2563eb', backgroundColor: '#EFF6FF', padding: '2px 8px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                                  Ballot #{cand.ballotNumber || idx + 1}
                                </span>
                                <label style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: 600 }}>Pos #</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={cand.ballotNumber || idx + 1}
                                  onChange={(e) => handleUpdateBallotNumber(cand.id, parseInt(e.target.value) || 1)}
                                  style={{
                                    width: '46px',
                                    padding: '2px 4px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    border: '1.5px solid #CBD5E1',
                                    textAlign: 'center',
                                    backgroundColor: '#FFFFFF'
                                  }}
                                  title="Change ballot position number"
                                />
                              </div>
                              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '4px 0 0 0', color: 'var(--text-primary)' }}>
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
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                            {cand.isIndependent ? 'Independent' : 'Candidate'}
                          </span>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              onClick={() => openEditCandidateModal(cand)}
                              className="btn btn-outline"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#2563eb', borderColor: 'rgba(37, 99, 235, 0.3)' }}
                            >
                              <Pencil size={14} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCandidate(cand.id)}
                              className="btn btn-outline"
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            >
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
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
        subtitle="Define position category name and voting selection limit"
      >
        <form onSubmit={handleCreatePosition} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={mLabelStyle}>Position Title *</label>
            <input
              type="text"
              required
              placeholder="e.g. Financial Secretary, SRC President"
              value={posTitle}
              onChange={(e) => setPosTitle(e.target.value)}
              style={mInputStyle}
            />
          </div>

          <div>
            <label style={mLabelStyle}>
              Maximum Number of Candidate Choices Allowed *
            </label>
            <input
              type="number"
              min={1}
              max={50}
              required
              placeholder="Enter max candidate choices (e.g. 1 for FPTP, 2 for top 2)"
              value={posMaxChoices}
              onChange={(e) => setPosMaxChoices(Math.max(1, parseInt(e.target.value) || 1))}
              style={mInputStyle}
            />
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '6px 0 0 0' }}>
              Enter the exact maximum number of candidates a voter can select for this position (1 = Single Winner).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#F8FAFC', padding: '0.85rem 1.1rem', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <input
              type="checkbox"
              id="referendum-check"
              checked={posIsReferendum}
              onChange={(e) => setPosIsReferendum(e.target.checked)}
              style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#2563EB' }}
            />
            <label htmlFor="referendum-check" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155', cursor: 'pointer' }}>
              Enable YES / NO Referendum Mode for Unopposed Candidates
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
            <button type="button" onClick={() => setIsPosModalOpen(false)} style={{ padding: '0.75rem 1.4rem', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={posSubmitting} style={{ padding: '0.75rem 1.6rem', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.4)' }}>
              {posSubmitting ? 'Saving Position...' : 'Save Position'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Candidate Modal */}
      <Modal
        isOpen={isCandModalOpen}
        onClose={() => {
          setIsCandModalOpen(false);
          setCandImagePreview('');
        }}
        title="Register Candidate"
        subtitle="Add a candidate profile and photo to this election workspace"
      >
        <form onSubmit={handleCreateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={mLabelStyle}>Full Candidate Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Kwame Mensah"
              value={candName}
              onChange={(e) => setCandName(e.target.value)}
              style={mInputStyle}
            />
          </div>

          <div>
            <label style={mLabelStyle}>Position Category *</label>
            <select
              required
              value={candPosition}
              onChange={(e) => setCandPosition(e.target.value)}
              style={mSelectStyle}
            >
              {positions.map(p => (
                <option key={p.id} value={p.title}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={mLabelStyle}>Ballot Position Number *</label>
            <input
              type="number"
              min={1}
              max={100}
              required
              placeholder="e.g. 1 (Ballot #1)"
              value={candBallotNumber}
              onChange={(e) => setCandBallotNumber(Math.max(1, parseInt(e.target.value) || 1))}
              style={mInputStyle}
            />
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '4px 0 0 0' }}>
              Specifies the fixed placement order of this candidate on voter screens (1 = Top position).
            </p>
          </div>

          <div>
            <label style={mLabelStyle}>
              Candidate Profile Photo Upload
            </label>
            
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '18px', border: '1.5px dashed #CBD5E1' }}>
              {/* Live Preview Avatar */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '22px',
                backgroundColor: '#EFF6FF',
                border: '2px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.2)'
              }}>
                {candImagePreview || candPhotoUrl ? (
                  <img src={candImagePreview || candPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Upload size={28} style={{ color: '#2563EB' }} />
                )}
              </div>

              {/* Controls */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label htmlFor="candidate-file-picker" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem', borderRadius: '12px', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', width: 'fit-content', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)' }}>
                  <Upload size={16} /> Choose Photo Image File
                </label>
                <input
                  id="candidate-file-picker"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const compressedBase64 = await compressImageFile(file, 300, 300, 0.8);
                        setCandImagePreview(compressedBase64);
                        setCandPhotoUrl(compressedBase64);
                      } catch (err) {
                        console.error('Failed to compress image file:', err);
                      }
                    }
                  }}
                />
                <input
                  type="url"
                  placeholder="Or paste photo URL (https://...)"
                  value={candPhotoUrl}
                  onChange={(e) => {
                    setCandPhotoUrl(e.target.value);
                    setCandImagePreview(e.target.value);
                  }}
                  style={{ ...mInputStyle, fontSize: '0.85rem', padding: '0.65rem 0.9rem' }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={mLabelStyle}>Manifesto & Bio Snippet</label>
            <textarea
              rows={3}
              placeholder="Brief campaign promise..."
              value={candManifesto}
              onChange={(e) => setCandManifesto(e.target.value)}
              style={{ ...mInputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
            <button type="button" onClick={() => setIsCandModalOpen(false)} style={{ padding: '0.75rem 1.4rem', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={candSubmitting} style={{ padding: '0.75rem 1.6rem', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.4)' }}>
              {candSubmitting ? 'Registering Candidate...' : 'Register Candidate'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Candidate Modal */}
      <Modal
        isOpen={!!editingCandidate}
        onClose={() => {
          setEditingCandidate(null);
          setEditImagePreview('');
        }}
        title="Edit Candidate Profile"
        subtitle="Update candidate details, photo, and ballot position number"
      >
        <form onSubmit={handleUpdateCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={mLabelStyle}>Full Candidate Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Kwame Mensah"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              style={mInputStyle}
            />
          </div>

          <div>
            <label style={mLabelStyle}>Position Category *</label>
            <select
              required
              value={editPosition}
              onChange={(e) => setEditPosition(e.target.value)}
              style={mSelectStyle}
            >
              {positions.map(p => (
                <option key={p.id} value={p.title}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={mLabelStyle}>Ballot Position Number *</label>
            <input
              type="number"
              min={1}
              max={100}
              required
              placeholder="e.g. 1"
              value={editBallotNumber}
              onChange={(e) => setEditBallotNumber(Math.max(1, parseInt(e.target.value) || 1))}
              style={mInputStyle}
            />
          </div>

          <div>
            <label style={mLabelStyle}>
              Candidate Profile Photo Upload
            </label>
            
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '18px', border: '1.5px dashed #CBD5E1' }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '22px',
                backgroundColor: '#EFF6FF',
                border: '2px solid #BFDBFE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.2)'
              }}>
                {editImagePreview || editPhotoUrl ? (
                  <img src={editImagePreview || editPhotoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Upload size={28} style={{ color: '#2563EB' }} />
                )}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <label htmlFor="edit-candidate-file-picker" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.7rem 1.25rem', borderRadius: '12px', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', width: 'fit-content', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)' }}>
                  <Upload size={16} /> Choose New Photo File
                </label>
                <input
                  id="edit-candidate-file-picker"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const compressedBase64 = await compressImageFile(file, 300, 300, 0.8);
                        setEditImagePreview(compressedBase64);
                        setEditPhotoUrl(compressedBase64);
                      } catch (err) {
                        console.error('Failed to compress image file:', err);
                      }
                    }
                  }}
                />
                <input
                  type="url"
                  placeholder="Or paste photo URL (https://...)"
                  value={editPhotoUrl}
                  onChange={(e) => {
                    setEditPhotoUrl(e.target.value);
                    setEditImagePreview(e.target.value);
                  }}
                  style={{ ...mInputStyle, fontSize: '0.85rem', padding: '0.65rem 0.9rem' }}
                />
              </div>
            </div>
          </div>

          <div>
            <label style={mLabelStyle}>Manifesto & Bio Snippet</label>
            <textarea
              rows={3}
              placeholder="Brief campaign promise..."
              value={editManifesto}
              onChange={(e) => setEditManifesto(e.target.value)}
              style={{ ...mInputStyle, resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
            <button type="button" onClick={() => setEditingCandidate(null)} style={{ padding: '0.75rem 1.4rem', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={editSubmitting} style={{ padding: '0.75rem 1.6rem', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.4)' }}>
              {editSubmitting ? 'Updating Candidate...' : 'Update Candidate'}
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
