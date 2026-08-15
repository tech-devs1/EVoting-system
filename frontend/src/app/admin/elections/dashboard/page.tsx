'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest, getAuthHeaders } from '@/lib/api';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Square, 
  Mail, 
  Send, 
  Download, 
  Users, 
  Vote, 
  Layers, 
  ShieldCheck, 
  Clock, 
  BarChart3, 
  Calendar,
  CheckCircle2,
  Edit,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Upload
} from 'lucide-react';
import Modal from '@/components/Modal';

const compressImageFile = (file: File, maxWidth = 400, maxHeight = 300, quality = 0.8): Promise<string> => {
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

interface Election {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: 'draft' | 'scheduled' | 'active' | 'ended' | 'completed';
  startDate: string;
  endDate: string;
  showResults?: boolean;
  previewImageUrl?: string;
  totalVoters?: number;
  totalVotesCast?: number;
  candidateCount?: number;
  positionCount?: number;
}

function PerElectionDashboardContent() {
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('Executive');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState<string>('active');
  const [editShowResults, setEditShowResults] = useState(false);
  const [editPreviewImageUrl, setEditPreviewImageUrl] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Send Invitations Modal States
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<'all' | 'individual' | 'custom'>('all');
  const [rosterVoters, setRosterVoters] = useState<{ id: string; name: string; email: string; studentId: string }[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [customEmailsInput, setCustomEmailsInput] = useState('');
  const [voterSearch, setVoterSearch] = useState('');
  const [sendingInvites, setSendingInvites] = useState(false);

  const fetchRosterVoters = async () => {
    try {
      const res = await apiRequest<{ status: string; data: any[] }>(`/elections/${electionId}/voters`);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setRosterVoters(res.data.filter(v => v.email && v.email !== 'N/A'));
      }
    } catch (e) {
      console.error('Failed to fetch roster voters:', e);
    }
  };

  const openInviteModal = () => {
    setIsInviteModalOpen(true);
    fetchRosterVoters();
  };

  async function fetchElectionData() {
    if (!electionId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
      if (res.status === 'success' && res.data) {
        setElection(res.data);
        setEditTitle(res.data.title || '');
        setEditDescription(res.data.description || '');
        setEditCategory(res.data.category || 'Executive');
        setEditStartDate(res.data.startDate ? new Date(res.data.startDate).toISOString().slice(0, 16) : '');
        setEditEndDate(res.data.endDate ? new Date(res.data.endDate).toISOString().slice(0, 16) : '');
        setEditStatus(res.data.status || 'active');
        setEditShowResults(Boolean(res.data.showResults));
        setEditPreviewImageUrl(res.data.previewImageUrl || '');
      }
    } catch (err: any) {
      console.error('Error loading election:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Save Edit Election Metadata
  const handleSaveElectionEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    setMessage(null);

    try {
      const res = await apiRequest<{ status: string; message: string }>(
        `/elections/${electionId}`,
        'PATCH',
        {
          title: editTitle,
          description: editDescription,
          category: editCategory,
          startDate: editStartDate,
          endDate: editEndDate,
          status: editStatus,
          showResults: editShowResults,
          previewImageUrl: editPreviewImageUrl
        }
      );

      if (res.status === 'success') {
        setMessage({ type: 'success', text: 'Election parameters updated successfully!' });
        setIsEditModalOpen(false);
        fetchElectionData();
      } else {
        throw new Error(res.message || 'Failed to update election');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update election parameters.' });
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle Results Publication Directly
  const handleTogglePublishResults = async () => {
    if (!election) return;
    const nextShow = !election.showResults;
    setActionLoading(true);
    setMessage(null);

    try {
      const res = await apiRequest<{ status: string; message: string }>(
        `/elections/${electionId}/toggle-results`,
        'PATCH',
        { showResults: nextShow }
      );

      if (res.status === 'success') {
        setMessage({
          type: 'success',
          text: nextShow
            ? 'Official Results are now PUBLISHED and live for voters to view!'
            : 'Official Results are now HIDDEN from voters.'
        });
        fetchElectionData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to toggle results publication.' });
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (electionId) fetchElectionData();
  }, [electionId]);

  // Update Status Action
  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ status: string; message: string }>(`/elections/${electionId}`, 'PUT', { status: newStatus });
      if (res.status === 'success') {
        setMessage({ type: 'success', text: `Election status updated to ${newStatus.toUpperCase()}.` });
        fetchElectionData();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to update election status.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Send Invitations Action
  const handleSendInvitations = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingInvites(true);
    setMessage(null);
    try {
      const res = await apiRequest<{ status: string; message: string }>(
        `/elections/${electionId}/send-invitations`,
        'POST',
        {
          recipientFilter: inviteMode,
          selectedEmails,
          customEmails: customEmailsInput
        }
      );
      if (res.status === 'success') {
        setMessage({ type: 'success', text: res.message || 'Voting invitations dispatched successfully!' });
        setIsInviteModalOpen(false);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to dispatch invitations.' });
    } finally {
      setSendingInvites(false);
    }
  };

  // Download Results PDF Action
  const [pdfLoading, setPdfLoading] = useState(false);
  const handleDownloadPDF = async () => {
    setActionLoading(true);
    setPdfLoading(true);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/elections/${electionId}/report/pdf`, {
        headers
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${election?.title || 'election'}_results.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setMessage({ type: 'success', text: 'Election results PDF generated and downloaded successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to generate PDF results.' });
    } finally {
      setActionLoading(false);
      setPdfLoading(false);
    }
  };

  // Export Audit CSV Action
  const handleExportAudit = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/elections/${electionId}/export-audit`, {
        headers
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_ledger_${electionId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error('Failed to export audit ledger:', err);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium text-xs">Loading election workspace...</div>;
  }

  if (!election) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Election Not Found</h3>
        <Link href="/admin/dashboard" className="inline-block mt-4 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors">
          Back to Organization Hub
        </Link>
      </div>
    );
  }

  const isElectionEnded = election ? (
    election.status === 'ended' ||
    election.status === 'completed' ||
    new Date(election.endDate).getTime() <= Date.now()
  ) : false;

  const turnout = (election.totalVoters && election.totalVoters > 0)
    ? Math.min(100, Math.round(((election.totalVotesCast || 0) / election.totalVoters) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner & Context */}
      <div>
        <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Organization Hub
        </Link>

        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 uppercase tracking-wider">
                {election.category || 'Executive'}
              </span>
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {election.title}
              </h2>
              {election.status === 'active' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">🟢 LIVE NOW</span>}
              {election.status === 'scheduled' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-900/30">⏰ SCHEDULED</span>}
              {election.status === 'ended' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">🏁 CLOSED</span>}
              {election.status === 'draft' && <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">📝 DRAFT</span>}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <Calendar size={14} className="text-slate-400" />
              <span>
                Window: <strong className="text-slate-700 dark:text-slate-300">{new Date(election.startDate).toLocaleString()}</strong> ➔ <strong className="text-slate-700 dark:text-slate-300">{new Date(election.endDate).toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={() => setIsEditModalOpen(true)} 
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Edit size={14} /> Edit Election Details
            </button>
            {election.status !== 'active' && (
              <button
                disabled={actionLoading || isElectionEnded}
                onClick={() => handleStatusChange('active')}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed"
                title={isElectionEnded ? "Election has ended. Extend the closing date to a future time in order to start it." : "Start Election"}
              >
                <Play size={14} /> Start Election
              </button>
            )}
            {election.status === 'active' && (
              <button 
                disabled={actionLoading} 
                onClick={() => handleStatusChange('ended')} 
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1.5"
              >
                <Square size={14} /> End Election
              </button>
            )}
            <button 
              disabled={actionLoading} 
              onClick={openInviteModal} 
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Mail size={14} /> Send Invitations
            </button>
            <button 
              disabled={actionLoading || pdfLoading} 
              onClick={handleDownloadPDF} 
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Download size={14} /> Download Results PDF
            </button>
            <button 
              onClick={handleExportAudit} 
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Download size={14} /> Audit Ledger CSV
            </button>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold ${
          message.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' 
            : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
        }`}>
          {message.text}
        </div>
      )}

      {/* Official Results Visibility & Public Access Card */}
      <div className={`p-5 rounded-2xl bg-white dark:bg-slate-800/90 border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm border-l-4 ${
        election.showResults ? 'border-l-emerald-500 border-slate-200 dark:border-slate-700' : 'border-l-amber-500 border-slate-200 dark:border-slate-700'
      }`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-extrabold flex items-center gap-1.5 ${
              election.showResults ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              {election.showResults ? <Eye size={16} /> : <EyeOff size={16} />}
              {election.showResults ? 'Official Results PUBLISHED to Voters' : 'Official Results HIDDEN from Voters'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {election.showResults
              ? 'Roster voters can view live charts, percentages, winner declarations, and audit logs.'
              : 'Public charts are locked. Only EC administrators can view live tally statistics until published.'}
          </p>
        </div>

        <button
          onClick={handleTogglePublishResults}
          disabled={actionLoading}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold shrink-0 transition-colors flex items-center gap-1.5 ${
            election.showResults
              ? 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20'
          }`}
        >
          {election.showResults ? <EyeOff size={16} /> : <Eye size={16} />}
          {election.showResults ? 'Unpublish / Hide Results' : '📢 Publish Official Results to All Voters'}
        </button>
      </div>

      {/* Election Workspace KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Ballots Cast</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{election.totalVotesCast || 0}</span>
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1"><span>{turnout}% Turnout</span></div>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
            <Vote size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Eligible Voters</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{election.totalVoters || 0}</span>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1"><span>Uploaded CSV roster</span></div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Positions & Lineup</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{election.candidateCount || 0}</span>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1"><span>Registered candidates</span></div>
          </div>
          <div className="p-3 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl">
            <Layers size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Access Health</span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">Nominal</span>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1"><span>0 Security Anomalies</span></div>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <ShieldCheck size={22} />
          </div>
        </div>
      </div>

      {/* Turnout Details Card */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">Live Election Status & Guidelines</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
          {election.description && !election.description.includes('Student Representative Council (SRC) election')
            ? election.description
            : `This is the ${election.title || 'election'} scheduled for ${election.startDate ? new Date(election.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'the active voting window'}. Eligible voters are invited to vote for their preferred candidates across all positions.`}
        </p>

        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60 p-4 rounded-2xl">
          <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
            <span>Live Turnout Progress</span>
            <span>{turnout}% ({election.totalVotesCast || 0} / {election.totalVoters || 0} voters)</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${turnout}%` }} />
          </div>
        </div>
      </div>

      {/* Edit Election Parameters Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Election Parameters"
        subtitle="Update title, description, time window, status, or results visibility"
        maxWidth="640px"
      >
        <form onSubmit={handleSaveElectionEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Election Title *
            </label>
            <input
              type="text"
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="e.g. 2026 HTU SRC General Elections"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                fontSize: '0.9rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.35rem' }}>
              Detailed Description
            </label>
            <textarea
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Provide voter instructions or eligibility rules..."
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                border: '1.5px solid #CBD5E1',
                backgroundColor: '#F8FAFC',
                color: '#0F172A',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', marginBottom: '0.35rem' }}>
                Category / Faculty Scope
              </label>
              <input
                type="text"
                list="edit-category-suggestions"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="e.g. Executive, Departmental, Faculty of Engineering"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1.5px solid #CBD5E1',
                  backgroundColor: '#F8FAFC',
                  color: '#0F172A',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
              <datalist id="edit-category-suggestions">
                <option value="Executive">SRC Executive Elections</option>
                <option value="Departmental">Departmental Elections</option>
                <option value="Hall">Hall of Residence Elections</option>
                <option value="Association">Faculty Association</option>
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Election Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              >
                <option value="draft">Draft (Setup Phase)</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active (Voting Open)</option>
                <option value="ended">Ended (Voting Closed)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Poll Opening Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                Poll Closing Date & Time *
              </label>
              <input
                type="datetime-local"
                required
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Election Preview / Card Image
            </label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{
                width: '120px',
                height: '90px',
                borderRadius: '12px',
                border: '1.5px dashed var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}>
                {editPreviewImageUrl ? (
                  <img src={editPreviewImageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImageIcon size={28} style={{ color: 'var(--text-tertiary)' }} />
                )}
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label htmlFor="edit-election-preview-picker" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  width: 'fit-content',
                  border: '1px solid #DBEAFE'
                }}>
                  <Upload size={14} /> Choose Card Image File
                </label>
                <input
                  id="edit-election-preview-picker"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const base64 = await compressImageFile(file, 400, 300, 0.8);
                        setEditPreviewImageUrl(base64);
                      } catch (err) {
                        console.error('Failed to compress image:', err);
                      }
                    }
                  }}
                />
                <input
                  type="url"
                  placeholder="Or paste direct image URL (https://...)"
                  value={editPreviewImageUrl.startsWith('data:image/') ? '' : editPreviewImageUrl}
                  onChange={(e) => setEditPreviewImageUrl(e.target.value)}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '12px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={editShowResults}
                onChange={(e) => setEditShowResults(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#2563eb' }}
              />
              <span>Publish Official Results Publicly to Roster Voters</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              style={{
                padding: '0.7rem 1.25rem',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              style={{
                padding: '0.7rem 1.4rem',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                fontWeight: 700,
                cursor: savingEdit ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
              }}
            >
              {savingEdit ? 'Saving Changes...' : 'Save Election Parameters'}
            </button>
          </div>
        </form>
      </Modal>

      {/* SEND INVITATIONS MODAL */}
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="📢 Dispatch Voting Invitations">
        <form onSubmit={handleSendInvitations} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Target Recipient Selection Mode
            </label>
            <select
              value={inviteMode}
              onChange={(e: any) => setInviteMode(e.target.value)}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '14px',
                border: '1.5px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.95rem',
                fontWeight: 700,
                boxSizing: 'border-box',
                outline: 'none'
              }}
            >
              <option value="all">👥 Batch: All Roster Members (Entire Election Directory)</option>
              <option value="individual">🎯 Individual: Select Specific Voter(s) from Roster List</option>
              <option value="custom">✍️ Custom: Input Specific Email Address(es)</option>
            </select>
          </div>

          {/* INDIVIDUAL VOTER SELECTION WIDGET */}
          {inviteMode === 'individual' && (
            <div style={{
              padding: '1.25rem',
              borderRadius: '16px',
              border: '1.5px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563EB' }}>
                  Selected ({selectedEmails.length} / {rosterVoters.length} Voters)
                </span>
                <div style={{ display: 'flex', gap: '0.65rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedEmails(rosterVoters.map(v => v.email.toLowerCase()))}
                    style={{ border: 'none', background: 'none', color: '#2563EB', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Select All
                  </button>
                  <span style={{ color: '#94A3B8' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedEmails([])}
                    style={{ border: 'none', background: 'none', color: '#DC2626', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Search voter by name, email, or student ID..."
                value={voterSearch}
                onChange={(e) => setVoterSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  marginBottom: '0.75rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />

              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem', paddingRight: '4px' }}>
                {rosterVoters
                  .filter(v => 
                    (v.name || '').toLowerCase().includes(voterSearch.toLowerCase()) ||
                    (v.email || '').toLowerCase().includes(voterSearch.toLowerCase()) ||
                    (v.studentId || '').toLowerCase().includes(voterSearch.toLowerCase())
                  )
                  .map(v => {
                    const isSelected = selectedEmails.includes(v.email.toLowerCase());
                    return (
                      <label
                        key={v.id || v.email}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.65rem',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '10px',
                          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-card)',
                          border: isSelected ? '1.5px solid #2563EB' : '1.5px solid var(--border-color)',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const emailLower = v.email.toLowerCase();
                            setSelectedEmails(prev => prev.includes(emailLower) ? prev.filter(e => e !== emailLower) : [...prev, emailLower]);
                          }}
                          style={{ accentColor: '#2563EB', width: '16px', height: '16px' }}
                        />
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.name} ({v.studentId})
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.email}
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>
          )}

          {/* CUSTOM EMAIL INPUT WIDGET */}
          {inviteMode === 'custom' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                Enter Custom Email Address(es) (separated by commas or newlines)
              </label>
              <textarea
                rows={4}
                value={customEmailsInput}
                onChange={(e) => setCustomEmailsInput(e.target.value)}
                placeholder="e.g. voter1@htu.edu.gh, voter2@htu.edu.gh, observer@htu.edu.gh"
                style={{
                  width: '100%',
                  padding: '0.85rem 1rem',
                  borderRadius: '14px',
                  border: '1.5px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  outline: 'none',
                  lineHeight: '1.5'
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(false)}
              style={{
                padding: '0.7rem 1.25rem',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendingInvites}
              style={{
                padding: '0.7rem 1.4rem',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                fontWeight: 700,
                cursor: sendingInvites ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
              }}
            >
              {sendingInvites ? 'Dispatching Invitations...' : 'Dispatch Invitations'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function PerElectionDashboardPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium text-xs">Loading election workspace...</div>}>
      <PerElectionDashboardContent />
    </Suspense>
  );
}
