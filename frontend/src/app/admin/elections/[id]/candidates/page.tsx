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
  const [submitting, setSubmitting] = useState(false);
  
  // Upload manifesto modal state
  const [uploadManifestoCand, setUploadManifestoCand] = useState<Candidate | null>(null);
  const [manifestoFile, setManifestoFile] = useState<File | null>(null);
  const [uploadingManifesto, setUploadingManifesto] = useState(false);

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

  const handleManifestoUpload = async () => {
    if (!uploadManifestoCand || !manifestoFile) return;
    setUploadingManifesto(true);
    try {
      const storageRef = ref(storage, `manifestos/${uploadManifestoCand.id}_${Date.now()}_${manifestoFile.name}`);
      await uploadBytes(storageRef, manifestoFile);
      const url = await getDownloadURL(storageRef);
      await apiRequest(`/candidates/${uploadManifestoCand.id}`, 'PATCH', { manifestoUrl: url });
      setCandidates(prev => prev.map(c => c.id === uploadManifestoCand.id ? { ...c, manifestoUrl: url } : c));
      setUploadManifestoCand(prev => prev ? { ...prev, manifestoUrl: url } : null);
      setManifestoFile(null);
      alert('Manifesto uploaded successfully!');
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploadingManifesto(false);
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
          const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_IdMY8+9qGvRoDF3lZfo+avVLvpw=";
          if (!publicKey) {
            throw new Error('NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY is missing on the client side. Please add it to your frontend deployment dashboard (e.g. Vercel settings) and trigger a new build.');
          }

          const formData = new FormData();
          formData.append('file', photoFile);
          formData.append('publicKey', publicKey);
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
        setPhotoFile(null);
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
              <button 
                type="button"
                className="btn btn-outline btn-full btn-sm" 
                onClick={() => setUploadManifestoCand(cand)}
                style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}
              >
                Upload Manifesto
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', marginTop: 'var(--space-1)' }}>
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
          {/* Candidate Name */}
          <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
            <label className="form-label" htmlFor="cand-name" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>Candidate Name</label>
            <input type="text" id="cand-name" className="form-input" placeholder="e.g. John Doe" required value={formName} onChange={e => setFormName(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
          </div>
          {/* Position */}
          <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
            <label className="form-label" htmlFor="cand-pos" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>Position</label>
            <input type="text" id="cand-pos" className="form-input" placeholder="e.g. President" required value={formPos} onChange={e => setFormPos(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
          </div>
          {/* Manifesto */}
          <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
            <label className="form-label" htmlFor="cand-man" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>Candidate Manifesto Statement</label>
            <textarea id="cand-man" className="form-input" placeholder="Paste candidate's full manifesto statement here..." style={{ width: '100%', minHeight: '140px', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} required value={formManifesto} onChange={e => setFormManifesto(e.target.value)}></textarea>
          </div>
          {/* Photo Upload */}
          <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
            <label className="form-label" htmlFor="cand-photo" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>Candidate Photo (Image) - Optional</label>
            <input type="file" id="cand-photo" accept="image/*" className="form-input" onChange={e => e.target.files && setPhotoFile(e.target.files[0])} style={{ width: '100%', padding: 'var(--space-1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
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

      {/* Upload Manifesto Modal */}
      {uploadManifestoCand && (
        <div className="modal-overlay active" onClick={() => { setUploadManifestoCand(null); setManifestoFile(null); }}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Upload Manifesto — {uploadManifestoCand.name}</h3>
              <button className="modal-close" onClick={() => { setUploadManifestoCand(null); setManifestoFile(null); }}>&times;</button>
            </div>
            <div className="modal-body">
              {uploadManifestoCand.manifestoUrl && (
                <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Current manifesto:</p>
                  <a href={uploadManifestoCand.manifestoUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                    📄 View Uploaded PDF
                  </a>
                </div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="manifesto-file" style={{ display: 'block', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
                  {uploadManifestoCand.manifestoUrl ? 'Replace manifesto (PDF / DOC)' : 'Upload manifesto file (PDF / DOC)'}
                </label>
                <input
                  type="file"
                  id="manifesto-file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="form-input"
                  onChange={e => e.target.files && setManifestoFile(e.target.files[0])}
                  style={{ width: '100%', padding: 'var(--space-1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
                {manifestoFile && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                    Selected: {manifestoFile.name}
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setUploadManifestoCand(null); setManifestoFile(null); }}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleManifestoUpload}
                disabled={!manifestoFile || uploadingManifesto}
              >
                {uploadingManifesto ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
