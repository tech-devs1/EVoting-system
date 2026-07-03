'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { Plus, ArrowLeft, Trash, Users } from 'lucide-react';

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

  // Add candidate modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPos, setFormPos] = useState('');
  const [formManifesto, setFormManifesto] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit manifesto modal
  const [editManifestoCand, setEditManifestoCand] = useState<Candidate | null>(null);
  const [manifestoContent, setManifestoContent] = useState<string>('');
  const [savingManifesto, setSavingManifesto] = useState(false);

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

  const openEditManifesto = (cand: Candidate) => {
    setManifestoContent(cand.manifesto || '');
    setEditManifestoCand(cand);
  };

  const closeEditManifesto = () => {
    setEditManifestoCand(null);
    setManifestoContent('');
  };

  const handleManifestoSave = async () => {
    if (!editManifestoCand) return;
    setSavingManifesto(true);
    try {
      await apiRequest(`/candidates/${editManifestoCand.id}`, 'PATCH', { manifesto: manifestoContent });
      setCandidates(prev =>
        prev.map(c => c.id === editManifestoCand.id ? { ...c, manifesto: manifestoContent } : c)
      );
      closeEditManifesto();
      alert('Manifesto updated successfully!');
    } catch (err: any) {
      alert('Failed to update manifesto: ' + err.message);
    } finally {
      setSavingManifesto(false);
    }
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!confirm('Are you sure you want to remove this candidate?')) return;
    try {
      await apiRequest(`/candidates/${candidateId}`, 'DELETE');
      setCandidates(prev => prev.filter(c => c.id !== candidateId));
    } catch (err: any) {
      alert('Failed to remove candidate: ' + err.message);
    }
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let photoUrl = '';

      if (photoFile) {
        const authRes = await apiRequest<{ signature: string; expire: number; token: string }>('/imagekit/auth', 'GET');
        if (!authRes?.signature) throw new Error('Failed to fetch ImageKit auth parameters');

        const publicKey = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || 'public_IdMY8+9qGvRoDF3lZfo+avVLvpw=';
        const formData = new FormData();
        formData.append('file', photoFile);
        formData.append('publicKey', publicKey);
        formData.append('signature', authRes.signature);
        formData.append('expire', authRes.expire.toString());
        formData.append('token', authRes.token);
        formData.append('fileName', `candidate_${Date.now()}_${photoFile.name}`);
        formData.append('folder', '/candidates');

        const uploadRes = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();
        if (uploadRes.ok) {
          photoUrl = uploadData.url;
        } else {
          throw new Error(uploadData.message || 'ImageKit upload failed');
        }
      }

      const res = await apiRequest<{ status: string; data: Candidate }>('/candidates', 'POST', {
        name: formName,
        position: formPos,
        manifesto: formManifesto,
        photoUrl,
        electionId,
      });

      if (res.status === 'success') {
        setCandidates(prev => [...prev, res.data]);
        setIsModalOpen(false);
        setFormName(''); setFormPos(''); setFormManifesto('');
        setPhotoFile(null);
      } else {
        alert('Failed to add candidate: ' + (res as any).message || 'Unknown error');
      }
    } catch (err: any) {
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
                onClick={() => openEditManifesto(cand)}
                style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-2)' }}
              >
                {cand.manifesto ? 'Edit Manifesto' : 'Upload Manifesto'}
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
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label" htmlFor="cand-name" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>Candidate Name</label>
                  <input type="text" id="cand-name" className="form-input" placeholder="e.g. John Doe" required value={formName} onChange={e => setFormName(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label" htmlFor="cand-pos" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>Position</label>
                  <input type="text" id="cand-pos" className="form-input" placeholder="e.g. President" required value={formPos} onChange={e => setFormPos(e.target.value)} style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label" htmlFor="cand-man" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>Manifesto Statement (optional)</label>
                  <textarea id="cand-man" className="form-input" placeholder="Paste candidate's manifesto here..." style={{ width: '100%', minHeight: '120px', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} value={formManifesto} onChange={e => setFormManifesto(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label" htmlFor="cand-photo" style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)' }}>Candidate Photo — Optional</label>
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

      {/* Edit / Upload Manifesto Modal (Rich Text) */}
      {editManifestoCand && (
        <div className="modal-overlay active" onClick={closeEditManifesto}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editManifestoCand.manifesto ? 'Edit' : 'Upload'} Manifesto — {editManifestoCand.name}
              </h3>
              <button className="modal-close" onClick={closeEditManifesto}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {/* Formatting toolbar */}
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', padding: 'var(--space-2)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <button type="button" className="btn btn-outline btn-sm" style={{ fontWeight: 'bold' }} onClick={() => document.execCommand('bold')}>B</button>
                <button type="button" className="btn btn-outline btn-sm" style={{ fontStyle: 'italic' }} onClick={() => document.execCommand('italic')}>I</button>
                <button type="button" className="btn btn-outline btn-sm" style={{ textDecoration: 'underline' }} onClick={() => document.execCommand('underline')}>U</button>
                <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 4px' }} />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => document.execCommand('insertUnorderedList')}>• List</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => document.execCommand('insertOrderedList')}>1. List</button>
                <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 4px' }} />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => document.execCommand('justifyLeft')}>≡ Left</button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => document.execCommand('justifyCenter')}>≡ Center</button>
              </div>

              {/* Editable area */}
              <div
                id="manifesto-editor"
                contentEditable
                suppressContentEditableWarning
                style={{
                  minHeight: '220px',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  overflowY: 'auto',
                  lineHeight: 1.7,
                  fontSize: 'var(--text-sm)',
                  outline: 'none',
                }}
                onInput={e => setManifestoContent(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: manifestoContent }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeEditManifesto}>Cancel</button>
              <button className="btn btn-primary" onClick={handleManifestoSave} disabled={savingManifesto}>
                {savingManifesto ? 'Saving...' : 'Save Manifesto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
