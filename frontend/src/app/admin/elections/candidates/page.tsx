'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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

function PerElectionCandidatesContent() {
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

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
    if (!electionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      
      const [posRes, candRes] = await Promise.all([
        apiRequest<{ status: string; data: Position[] }>(`/elections/${electionId}/positions`),
        apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`)
      ]);

      if (posRes.status === 'success' && Array.isArray(posRes.data)) {
        setPositions(posRes.data);
        if (posRes.data.length > 0) {
          setCandPosition(prev => (prev && posRes.data.some(p => p.title === prev)) ? prev : posRes.data[0].title);
        } else {
          setCandPosition('');
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
        setCandPosition(prev => prev || res.data.title);
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
      setPositions(prev => {
        const next = prev.filter(p => p.id !== posId);
        if (next.length > 0) {
          setCandPosition(cur => (cur && next.some(p => p.title === cur)) ? cur : next[0].title);
        } else {
          setCandPosition('');
        }
        return next;
      });
    } catch (err: any) {
      alert(err.message || 'Failed to delete position.');
    }
  };

  // Create Candidate Submit
  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPosition = candPosition || (positions.length > 0 ? positions[0].title : '');
    if (!candName.trim()) {
      alert('Please enter candidate name.');
      return;
    }
    if (!targetPosition) {
      alert('Please select or add a position type first.');
      return;
    }
    setCandSubmitting(true);

    try {
      const payload = {
        name: candName.trim(),
        position: targetPosition,
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
    <div className="flex flex-col gap-6">
      {/* Workspace Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Positions & Candidates Builder
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Define position types, set selection rules, and organize candidates into position groups
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => setIsPosModalOpen(true)} 
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} /> Add Position Type
          </button>
          <button 
            onClick={() => setIsCandModalOpen(true)} 
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} /> Register Candidate
          </button>
          <button 
            onClick={() => setIsPreviewOpen(true)} 
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
          >
            <Eye size={16} /> Live Ballot Preview
          </button>
        </div>
      </div>

      {/* Position Types Configured Bar */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
          <Layers size={18} className="text-blue-600 dark:text-blue-400" /> Configured Position Types ({positions.length})
        </h3>
        
        <div className="flex items-center gap-2.5 flex-wrap">
          {positions.map((pos) => (
            <div 
              key={pos.id}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 text-xs font-bold text-slate-800 dark:text-slate-200"
            >
              <span>{pos.title}</span>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                Select {pos.maxChoices}
              </span>
              {pos.isReferendum && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">YES/NO</span>
              )}
              <button 
                onClick={() => handleDeletePosition(pos.id)}
                className="text-red-500 hover:text-red-700 transition-colors ml-1"
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
        <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading position lineups...</p>
      ) : Object.keys(candidatesByPosition).length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
          No position types configured yet. Click "+ Add Position Type" to begin.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(candidatesByPosition).map(([posTitle, candList]) => {
            const posMeta = positions.find(p => p.title === posTitle);

            return (
              <div 
                key={posTitle}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm"
              >
                {/* Position Group Header */}
                <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100 dark:border-slate-700/60 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                      <Award size={18} />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {posTitle}
                      </h3>
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Voters select up to {posMeta?.maxChoices || 1} candidate{posMeta?.maxChoices !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30">
                    {candList.length} Candidate{candList.length !== 1 ? 's' : ''} Listed
                  </span>
                </div>

                {/* Candidate Cards Grid for THIS Position */}
                {candList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                    No candidates registered under {posTitle} yet. Click "+ Register Candidate" above to add one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {candList.map((cand, idx) => (
                      <div 
                        key={cand.id}
                        className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between"
                      >
                        <div>
                          {/* Photo & Name */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center font-extrabold text-sm text-slate-700 dark:text-slate-200 border-2 border-blue-600 shrink-0">
                              {cand.photoUrl ? (
                                <img src={cand.photoUrl} alt={cand.name} className="w-full h-full object-cover" />
                              ) : (
                                cand.name.substring(0, 2).toUpperCase()
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-900/30">
                                  Ballot #{cand.ballotNumber || idx + 1}
                                </span>
                                <label className="text-[10px] text-slate-400 font-bold">Pos #</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={cand.ballotNumber || idx + 1}
                                  onChange={(e) => handleUpdateBallotNumber(cand.id, parseInt(e.target.value) || 1)}
                                  className="w-10 px-1 py-0.5 rounded-md text-xs font-extrabold text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white"
                                  title="Change ballot position number"
                                />
                              </div>
                              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                                {cand.name}
                              </h4>
                            </div>
                          </div>

                          {/* Manifesto Snippet */}
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4 line-clamp-2">
                            {cand.manifesto || 'No manifesto summary provided.'}
                          </p>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                            {cand.isIndependent ? 'Independent' : 'Candidate'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => openEditCandidateModal(cand)}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCandidate(cand.id)}
                              className="px-2.5 py-1 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Remove
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
        {positions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <p style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 600, marginBottom: '1.25rem' }}>
              No position types configured for this election yet. Please create at least one position type before registering candidates.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsCandModalOpen(false);
                setIsPosModalOpen(true);
              }}
              style={{ padding: '0.75rem 1.4rem', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
            >
              + Add Position Type First
            </button>
          </div>
        ) : (
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
              value={candPosition || (positions.length > 0 ? positions[0].title : '')}
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
            <button type="submit" disabled={candSubmitting || positions.length === 0} style={{ padding: '0.75rem 1.6rem', borderRadius: '14px', border: 'none', background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', boxShadow: '0 8px 20px -4px rgba(37, 99, 235, 0.4)' }}>
              {candSubmitting ? 'Registering Candidate...' : 'Register Candidate'}
            </button>
          </div>
        </form>
        )}
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

export default function PerElectionCandidatesPage() {
  return (
    <Suspense fallback={<p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading position lineups...</p>}>
      <PerElectionCandidatesContent />
    </Suspense>
  );
}
