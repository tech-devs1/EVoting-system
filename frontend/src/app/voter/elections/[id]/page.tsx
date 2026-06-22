'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { ArrowLeft, Columns2, Check, ArrowRight } from 'lucide-react';

interface Candidate {
  id: string;
  name: string;
  position: string;
  manifesto: string;
  photoUrl: string;
}

interface Election {
  id: string;
  title: string;
  description: string;
}

export default function CandidateSelectionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const electionId = resolvedParams.id;

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  
  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [activeProfileCandidate, setActiveProfileCandidate] = useState<Candidate | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const electionRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
        if (electionRes.status === 'success') {
          setElection(electionRes.data);
        }

        const candidatesRes = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`);
        if (candidatesRes.status === 'success') {
          setCandidates(candidatesRes.data);
        }
      } catch (err) {
        console.error('Error fetching candidate selection details:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [electionId]);

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Synchronizing candidate profiles...</p>;
  }

  if (!election) {
    return (
      <div className="empty-state">
        <h3>Election Not Found</h3>
        <p>No valid active election parameters were passed to this terminal session.</p>
        <Link href="/voter/elections" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
          Back to List
        </Link>
      </div>
    );
  }

  const handleCardClick = (candId: string) => {
    setSelectedCandidateId(candId);
  };

  const openProfileModal = (cand: Candidate, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveProfileCandidate(cand);
    setIsProfileModalOpen(true);
  };

  const selectCandidateFromModal = () => {
    if (activeProfileCandidate) {
      setSelectedCandidateId(activeProfileCandidate.id);
      setIsProfileModalOpen(false);
    }
  };

  const selectCandidateFromCompare = (candId: string) => {
    setSelectedCandidateId(candId);
    setIsCompareModalOpen(false);
  };

  const handleProceed = () => {
    if (selectedCandidateId) {
      router.push(`/voter/elections/${electionId}/confirm?candidateId=${selectedCandidateId}`);
    }
  };

  return (
    <div className="candidate-selection-container animate-page-enter">
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <Link href="/voter/elections" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: 'var(--space-4)' }}>
          <ArrowLeft size={16} /> Return to Elections
        </Link>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>{election.title}</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', maxWidth: '700px' }}>{election.description}</p>
      </div>

      {/* Action items panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)' }}>Select Your Candidate</h3>
        <button className="btn btn-secondary btn-sm" onClick={() => setIsCompareModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Columns2 size={16} /> Compare Candidates Side-by-Side
        </button>
      </div>

      <div className="candidate-grid">
        {candidates.map(cand => {
          const isSelected = selectedCandidateId === cand.id;
          return (
            <div 
              className={`card candidate-card ${isSelected ? 'selected' : ''}`} 
              key={cand.id}
              onClick={() => handleCardClick(cand.id)}
              style={{ cursor: 'pointer' }}
            >
              <div className="candidate-select-indicator" style={{ display: isSelected ? 'flex' : 'none' }}>
                <Check size={14} />
              </div>
              <img 
                src={cand.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'} 
                alt={cand.name} 
                className="candidate-photo" 
              />
              <h4 className="candidate-name">{cand.name}</h4>
              <span className="candidate-position">{cand.position}</span>
              <p className="candidate-manifesto line-clamp-3" style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                {cand.manifesto}
              </p>
              <button 
                type="button"
                className="btn btn-outline btn-full btn-sm cand-expand-profile-btn" 
                onClick={(e) => openProfileModal(cand, e)}
              >
                View Full Profile & Manifesto
              </button>
            </div>
          );
        })}
      </div>

      {/* Next Submit Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-4)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-6)', marginTop: 'var(--space-8)' }}>
        <Link href="/voter/elections" className="btn btn-secondary">Cancel</Link>
        <button 
          className="btn btn-primary" 
          disabled={!selectedCandidateId}
          onClick={handleProceed}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          Review Selection <ArrowRight size={16} />
        </button>
      </div>

      {/* Profile Modal */}
      {isProfileModalOpen && activeProfileCandidate && (
        <div className="modal-overlay active" onClick={() => setIsProfileModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{activeProfileCandidate.name}</h3>
              <button className="modal-close" onClick={() => setIsProfileModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <img 
                src={activeProfileCandidate.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'} 
                alt={activeProfileCandidate.name} 
                style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: 'var(--radius-lg)' }} 
              />
              <div>
                <span className="candidate-position">{activeProfileCandidate.position}</span>
                <p style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, marginTop: 'var(--space-2)' }}>
                  {activeProfileCandidate.manifesto}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsProfileModalOpen(false)}>Close</button>
              <button className="btn btn-primary" onClick={selectCandidateFromModal}>Select Candidate</button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {isCompareModalOpen && (
        <div className="modal-overlay active" onClick={() => setIsCompareModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Compare Candidates</h3>
              <button className="modal-close" onClick={() => setIsCompareModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body candidate-compare-overlay">
              {candidates.map(cand => (
                <div 
                  key={cand.id}
                  style={{ 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-lg)', 
                    padding: 'var(--space-4)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: 'var(--space-3)' 
                  }}
                >
                  <img 
                    src={cand.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'} 
                    alt={cand.name} 
                    style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} 
                  />
                  <h4 style={{ margin: 0 }}>{cand.name}</h4>
                  <span className="badge badge-info" style={{ alignSelf: 'flex-start' }}>{cand.position}</span>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {cand.manifesto}
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={() => selectCandidateFromCompare(cand.id)}>
                    Select
                  </button>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsCompareModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
