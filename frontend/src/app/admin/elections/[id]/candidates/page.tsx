'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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

  // Predefined positions list
  const PRESET_POSITIONS = [
    'President',
    'Financial Secretary',
    ' General Secretary',
    'Organizing Secretary',
    'Public Relations Officer (PRO)',
    'WOCOM',
  ];

  // Add candidate modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formPosSelect, setFormPosSelect] = useState('');   // dropdown value
  const [formPosCustom, setFormPosCustom] = useState('');   // free-text when "custom"
  const [formManifesto, setFormManifesto] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Resolved position — either the dropdown pick or the custom text
  const formPos = formPosSelect === '__custom__' ? formPosCustom : formPosSelect;

  // Edit manifesto modal
  const [editManifestoCand, setEditManifestoCand] = useState<Candidate | null>(null);
  const [manifestoContent, setManifestoContent] = useState<string>('');
  const [savingManifesto, setSavingManifesto] = useState(false);

  // Ref to imperatively clear the add-manifesto rich-text editor
  const addManifestoEditorRef = useRef<HTMLDivElement>(null);

  const clearAddManifestoEditor = () => {
    setFormManifesto('');
    if (addManifestoEditorRef.current) addManifestoEditorRef.current.innerHTML = '';
  };

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
        setFormName(''); setFormPosSelect(''); setFormPosCustom(''); clearAddManifestoEditor();
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
      <div
        className="candidate-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-4)',
          padding: 'var(--space-4)',
        }}
      >
        {candidates.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <Users size={48} style={{ color: 'var(--text-tertiary)' }} />
            <h3>No Candidates</h3>
            <p>No candidate entries exist for this ballot. Tap Add Candidate above to get started.</p>
          </div>
        ) : (
          candidates.map(cand => (
            <div className="card candidate-card" key={cand.id}>
              {/* Photo wrapper — fixed size so image is always fully visible */}
              <div className="candidate-photo-wrap">
                <img
                  src={cand.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'}
                  alt={cand.name}
                  className="candidate-photo"
                />
              </div>

              {/* Content */}
              <div className="candidate-content">
                <div className="candidate-info">
                  <h4 className="candidate-name">{cand.name}</h4>
                  <span className="candidate-position">{cand.position}</span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)', display: 'block' }}>
                    Votes: <strong style={{ color: 'var(--text-primary)' }}>{cand.votes || 0}</strong>
                  </span>
                </div>

                <div className="candidate-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => openEditManifesto(cand)}
                  >
                    {cand.manifesto ? 'Edit Manifesto' : 'Upload Manifesto'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => handleDeleteCandidate(cand.id)}
                  >
                    <Trash size={13} /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Candidate Modal — portal to escape overflow:hidden on app-shell */}
      {mounted && isModalOpen && createPortal(
        <div
          onClick={() => { setIsModalOpen(false); setFormPosSelect(''); setFormPosCustom(''); clearAddManifestoEditor(); }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '80px 16px 88px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            className="modal-container"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '560px', maxHeight: 'calc(100dvh - 180px)' }}
          >
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
                  <select
                    id="cand-pos"
                    className="form-input"
                    required
                    value={formPosSelect}
                    onChange={e => { setFormPosSelect(e.target.value); setFormPosCustom(''); }}
                    style={{ width: '100%', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: formPosSelect ? 'var(--text-primary)' : 'var(--text-tertiary)', appearance: 'auto' }}
                  >
                    <option value="" disabled>Select a position…</option>
                    {PRESET_POSITIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="__custom__">✏️ Custom position…</option>
                  </select>
                  {formPosSelect === '__custom__' && (
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter custom position name"
                      required
                      value={formPosCustom}
                      onChange={e => setFormPosCustom(e.target.value)}
                      autoFocus
                      style={{ width: '100%', marginTop: 'var(--space-2)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-primary, #6366f1)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none' }}
                    />
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label style={{ display: 'block', marginBottom: 'var(--space-1)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
                    Manifesto Statement <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', padding: 'var(--space-2)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md) var(--radius-md) 0 0', border: '1px solid var(--border-color)', borderBottom: 'none' }}>
                    <button type="button" className="btn btn-outline btn-sm" style={{ fontWeight: 'bold', minWidth: 32 }} onMouseDown={e => { e.preventDefault(); document.execCommand('bold'); }}>B</button>
                    <button type="button" className="btn btn-outline btn-sm" style={{ fontStyle: 'italic', minWidth: 32 }} onMouseDown={e => { e.preventDefault(); document.execCommand('italic'); }}>I</button>
                    <button type="button" className="btn btn-outline btn-sm" style={{ textDecoration: 'underline', minWidth: 32 }} onMouseDown={e => { e.preventDefault(); document.execCommand('underline'); }}>U</button>
                    <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />
                    <button type="button" className="btn btn-outline btn-sm" onMouseDown={e => { e.preventDefault(); document.execCommand('insertUnorderedList'); }}>• List</button>
                    <button type="button" className="btn btn-outline btn-sm" onMouseDown={e => { e.preventDefault(); document.execCommand('insertOrderedList'); }}>1. List</button>
                    <div style={{ width: '1px', background: 'var(--border-color)', margin: '0 2px' }} />
                    <button type="button" className="btn btn-outline btn-sm" onMouseDown={e => { e.preventDefault(); document.execCommand('justifyLeft'); }}>≡ Left</button>
                    <button type="button" className="btn btn-outline btn-sm" onMouseDown={e => { e.preventDefault(); document.execCommand('justifyCenter'); }}>≡ Center</button>
                  </div>
                  <div
                    id="add-manifesto-editor"
                    ref={addManifestoEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={e => setFormManifesto(e.currentTarget.innerHTML)}
                    style={{ minHeight: '130px', padding: 'var(--space-3)', borderRadius: '0 0 var(--radius-md) var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', overflowY: 'auto', lineHeight: 1.7, fontSize: 'var(--text-sm)', outline: 'none' }}
                    data-placeholder="Write the candidate's manifesto here…"
                  />
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
        </div>,
        document.body
      )}

      {/* Edit Manifesto Modal — portal to escape overflow:hidden on app-shell */}
      {mounted && editManifestoCand && createPortal(
        <div
          onClick={closeEditManifesto}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '80px 16px 88px 16px',
            overflowY: 'auto',
          }}
        >
          <div
            className="modal-container"
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '560px', maxHeight: 'calc(100dvh - 180px)' }}
          >
            <div className="modal-header">
              <h3 className="modal-title">
                {editManifestoCand.manifesto ? 'Edit' : 'Upload'} Manifesto — {editManifestoCand.name}
              </h3>
              <button className="modal-close" onClick={closeEditManifesto}>&times;</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
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
              <div
                id="manifesto-editor"
                contentEditable
                suppressContentEditableWarning
                style={{ minHeight: '220px', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', overflowY: 'auto', lineHeight: 1.7, fontSize: 'var(--text-sm)', outline: 'none' }}
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
        </div>,
        document.body
      )}
    </div>
  );
}
