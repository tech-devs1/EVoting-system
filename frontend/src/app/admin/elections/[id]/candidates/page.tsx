'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { Plus, ArrowLeft, Trash, AlertTriangle, Users } from 'lucide-react';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface Candidate {
  id: string;
  name: string;
  position: string;
  manifesto: string;
  manifestoUrl?: string;
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [manifestoFile, setManifestoFile] = useState<File | null>(null);
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

  const handleDeleteCandidate = async (candidateId: string) => {
    try {
      console.log('[Delete Candidate] Deleting candidate:', candidateId);
      await apiRequest(`/candidates/${candidateId}`, 'DELETE');
      console.log('[Delete Candidate] Candidate deleted successfully');
      setCandidates(prev => prev.filter(c => c.id !== candidateId));
      alert('Candidate removed successfully');
    } catch (err: any) {
      console.error('[Delete Candidate] Error:', err);
      alert('Failed to remove candidate: ' + err.message);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      console.log('[Add Candidate] Starting candidate creation...');
      console.log('[Add Candidate] Form data:', { name: formName, position: formPos, electionId });
      
      let photoUrl = '';
      let manifestoUrl = '';
      
      if (photoFile) {
        console.log('[Add Candidate] Uploading photo to ImageKit...');
        try {
          // 1. Get Auth params from our backend
          const authRes = await apiRequest<{ signature: string; expire: number; token: string }>('/imagekit/auth', 'GET');
          
          if (!authRes || !authRes.signature) {
            throw new Error('Failed to fetch ImageKit auth parameters');
          }

          // 2. Upload directly to ImageKit
          const formData = new FormData();
          formData.append('file', photoFile);
          formData.append('publicKey', process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || '');
          formData.append('signature', authRes.signature);
          formData.append('expire', authRes.expire.toString());
          formData.append('token', authRes.token);
          formData.append('fileName', `candidate_${Date.now()}_${photoFile.name}`);
          formData.append('folder', '/candidates'); // Optional: organize in folder
          
          const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            body: formData
          });
          
          const uploadData = await uploadRes.json();
          
          if (uploadRes.ok) {
            photoUrl = uploadData.url;
            console.log('[Add Candidate] Photo uploaded to ImageKit:', photoUrl);
          } else {
            console.error('[Add Candidate] ImageKit upload failed:', uploadData);
            throw new Error(uploadData.message || 'ImageKit upload failed: Invalid keys or missing configuration. Did you restart the server?');
          }
        } catch (uploadError: any) {
          console.error('[Add Candidate] Photo upload failed:', uploadError);
          alert('Photo upload failed: ' + uploadError.message);
          setSubmitting(false);
          return; // Stop candidate creation if photo upload fails!
        }
      } else {
        console.log('[Add Candidate] No photo provided, skipping upload');
      }
      
      if (manifestoFile) {
        console.log('[Add Candidate] Uploading manifesto...');
        try {
          const manRef = ref(storage, `candidates/manifestos/${Date.now()}_${manifestoFile.name}`);
          await uploadBytes(manRef, manifestoFile);
          manifestoUrl = await getDownloadURL(manRef);
          console.log('[Add Candidate] Manifesto uploaded:', manifestoUrl);
        } catch (uploadError) {
          console.error('[Add Candidate] Manifesto upload failed, continuing without manifesto:', uploadError);
          // Continue without manifesto if upload fails
        }
      } else {
        console.log('[Add Candidate] No manifesto provided, skipping upload');
      }

      console.log('[Add Candidate] Sending API request...');
      const res = await apiRequest<{ status: string; data: Candidate }>('/candidates', 'POST', {
        name: formName,
        position: formPos,
        manifesto: formManifesto,
        photoUrl,
        manifestoUrl,
        electionId
      });
      
      console.log('[Add Candidate] API response:', res);
      
      if (res.status === 'success') {
        setCandidates(prev => [...prev, res.data]);
        setIsModalOpen(false);
        setFormName(''); setFormPos(''); setFormManifesto('');
        setPhotoFile(null); setManifestoFile(null);
        alert('Candidate added successfully!');
      } else {
        alert('Failed to add candidate: ' + (res as any).message || 'Unknown error');
      }
    } catch (err: any) {
      console.error('[Add Candidate] Error:', err);
      alert('Failed to add candidate: ' + err.message);
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
              <p className="candidate-manifesto line-clamp-3" style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
                {cand.manifesto}
              </p>
              {cand.manifestoUrl && (
                <a href={cand.manifestoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: '11px', color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
                  📄 View PDF Manifesto
                </a>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                  Votes: <strong style={{ color: 'var(--text-primary)' }}>{cand.votes || 0}</strong>
                </span>
              </div>
              <button
                className="btn btn-sm btn-full"
                style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => handleDeleteCandidate(cand.id)}
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
                  <label className="form-label" htmlFor="cand-man">Short Description</label>
                  <textarea id="cand-man" className="form-input" placeholder="Brief summary of manifesto..." style={{ minHeight: '60px' }} required value={formManifesto} onChange={e => setFormManifesto(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                  <label className="form-label" htmlFor="cand-photo">Candidate Photo (Image) - Optional</label>
                  <input type="file" id="cand-photo" accept="image/*" className="form-input" onChange={e => e.target.files && setPhotoFile(e.target.files[0])} />
                </div>
                <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                  <label className="form-label" htmlFor="cand-man-file">Manifesto Document (PDF) - Optional</label>
                  <input type="file" id="cand-man-file" accept=".pdf" className="form-input" onChange={e => e.target.files && setManifestoFile(e.target.files[0])} />
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
