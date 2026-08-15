'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, 
  Send, 
  Mail, 
  Smartphone, 
  Zap, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Sparkles,
  BarChart3,
  Eye,
  Search,
  Check,
  ChevronRight,
  Info
} from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description?: string;
  voterCount?: number;
}

interface BroadcastLog {
  id: string;
  channel: 'email' | 'sms' | 'both';
  recipientFilter: string;
  subject: string;
  body: string;
  recipientCount: number;
  emailSentCount: number;
  smsSentCount: number;
  senderEmail: string;
  createdAt: number;
}

interface RosterVoter {
  id: string;
  name: string;
  email: string;
  studentId: string;
}

function ElectionMessagesContent() {
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<BroadcastLog[]>([]);

  // Roster Voters & Target Email Selection States
  const [rosterVoters, setRosterVoters] = useState<RosterVoter[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [customEmailsInput, setCustomEmailsInput] = useState('');
  const [voterSearch, setVoterSearch] = useState('');

  // Composer Form States
  const [channel, setChannel] = useState<'both' | 'email' | 'sms'>('email');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'pending' | 'voted' | 'individual' | 'custom'>('pending');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  useEffect(() => {
    if (!electionId) {
      setLoading(false);
      return;
    }

    async function initData() {
      try {
        setLoading(true);
        const elRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
        if (elRes.status === 'success') {
          setElection(elRes.data);
          setSubject(`Important Voting Notice: ${elRes.data.title}`);
          setBody(`Hello {{voter_name}},\n\nThis is an official voting reminder for "${elRes.data.title}".\n\nPlease use your Index Number ({{index_number}}) to log in and cast your ballot before polls close.\n\nAccess your voting ballot here:\n{{voting_link}}\n\nThank you,\nHTU Electoral Commission`);
        }

        const histRes = await apiRequest<{ status: string; data: BroadcastLog[] }>(`/elections/${electionId}/broadcast-history`);
        if (histRes.status === 'success' && Array.isArray(histRes.data)) {
          setHistory(histRes.data);
        }

        const rosterRes = await apiRequest<{ status: string; data: RosterVoter[] }>(`/elections/${electionId}/voters`);
        if (rosterRes.status === 'success' && Array.isArray(rosterRes.data)) {
          const cleanVoters = rosterRes.data.filter(v => v.email && v.email !== 'N/A');
          setRosterVoters(cleanVoters);
        }
      } catch (err) {
        console.error('Error initializing message hub:', err);
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, [electionId]);

  // Insert Variable Tag into Body Text
  const handleInsertTag = (tag: string) => {
    setBody(prev => prev + ` ${tag}`);
  };

  // Quick Preset Templates
  const handleApplyPreset = (preset: 'open' | 'reminder' | 'closing' | 'results') => {
    if (!election) return;
    if (preset === 'open') {
      setSubject(`Voting Open: ${election.title}`);
      setBody(`Dear {{voter_name}},\n\nVoting for "${election.title}" is officially OPEN!\n\nYour Student ID: {{index_number}}\nClick the link below to verify your identity and cast your secure ballot:\n{{voting_link}}\n\nYour vote counts!\nHTU Electoral Commission`);
    } else if (preset === 'reminder') {
      setSubject(`Voting Reminder: Cast Your Vote for ${election.title}`);
      setBody(`Hello {{voter_name}},\n\nOur records show you have not yet cast your vote for "${election.title}".\n\nDon't miss the deadline! Click below to access your ballot now:\n{{voting_link}}\n\nThank you,\nHTU Electoral Commission`);
    } else if (preset === 'closing') {
      setSubject(`URGENT: 1 Hour Remaining to Vote in ${election.title}`);
      setBody(`URGENT NOTICE for {{voter_name}}:\n\nPolls for "${election.title}" will close in 1 hour!\n\nPlease cast your vote immediately at:\n{{voting_link}}\n\nHTU Electoral Commission`);
    } else if (preset === 'results') {
      setSubject(`Official Results Released: ${election.title}`);
      setBody(`Hello {{voter_name}},\n\nVoting has concluded and the official cryptographically verified results for "${election.title}" are now live.\n\nView full results breakdowns at:\n{{voting_link}}\n\nThank you for participating,\nHTU Electoral Commission`);
    }
  };

  const toggleSelectEmail = (email: string) => {
    setSelectedEmails(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleSelectAllRoster = () => {
    const allEmails = rosterVoters.map(v => v.email.toLowerCase());
    setSelectedEmails(allEmails);
  };

  const handleClearSelectedRoster = () => {
    setSelectedEmails([]);
  };

  // Dispatch Broadcast Message
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setFeedback({ type: 'error', text: 'Message body cannot be empty.' });
      return;
    }

    if (recipientFilter === 'individual' && selectedEmails.length === 0) {
      setFeedback({ type: 'error', text: 'Please select at least one individual voter email address.' });
      return;
    }

    if (recipientFilter === 'custom' && !customEmailsInput.trim()) {
      setFeedback({ type: 'error', text: 'Please enter at least one custom email address.' });
      return;
    }

    if (!confirm(`Are you sure you want to dispatch this ${channel.toUpperCase()} broadcast message to matching voters?`)) {
      return;
    }

    setSending(true);
    setFeedback(null);

    try {
      const res = await apiRequest<{ status: string; message: string; data?: BroadcastLog }>(
        `/elections/${electionId}/broadcast-message`,
        'POST',
        { 
          channel, 
          recipientFilter, 
          selectedEmails, 
          customEmails: customEmailsInput, 
          subject, 
          body 
        }
      );

      if (res.status === 'success') {
        setFeedback({ type: 'success', text: res.message });

        // Refresh History Log list after a successful dispatch
        const histRes = await apiRequest<{ status: string; data: BroadcastLog[] }>(`/elections/${electionId}/broadcast-history`);
        if (histRes.status === 'success' && Array.isArray(histRes.data)) {
          setHistory(histRes.data);
        }

        setActiveTab('history');
      } else {
        throw new Error(res.message || 'Failed to dispatch broadcast message.');
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to send broadcast message.' });
    } finally {
      setSending(false);
    }
  };

  const smsChars = body.length;
  const smsSegments = Math.ceil(smsChars / 160) || 1;

  if (loading || !election) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500 font-medium text-xs">
        Loading Broadcast Communicator...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Top Header & Workspace Route Navigator */}
      <div>
        <Link 
          href={`/admin/elections/dashboard?electionId=${electionId}`}
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3"
        >
          <ArrowLeft size={14} /> Back to Election Command Center
        </Link>

        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <Mail size={28} className="text-blue-600 dark:text-blue-400" /> Broadcast Communicator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Design, preview, and securely dispatch dual Email & SMS broadcast announcements to your roster voters.
            </p>
          </div>

          {/* Premium Selector Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab('compose')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeTab === 'compose'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Send size={14} /> Compose Broadcast
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText size={14} /> Transmission Logs ({history.length})
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-3 ${
          feedback.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' 
            : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <AlertCircle size={18} className="text-red-500 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {activeTab === 'compose' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* LEFT COLUMN: Premium Email/SMS Composer Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Quick Presets Section */}
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 0 1rem 0' }}>
                <Sparkles size={16} style={{ color: '#2563eb' }} /> 1-Click Message Presets & Templates
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('open')}
                  style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, backgroundColor: '#F8FAFC', cursor: 'pointer', color: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                  className="preset-btn"
                >
                  <Send size={14} style={{ color: '#10B981' }} /> Voting Officially Open
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('reminder')}
                  style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, backgroundColor: '#F8FAFC', cursor: 'pointer', color: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                  className="preset-btn"
                >
                  <Clock size={14} style={{ color: '#F59E0B' }} /> Pending Voter Reminder
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('closing')}
                  style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, backgroundColor: '#F8FAFC', cursor: 'pointer', color: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                  className="preset-btn"
                >
                  <AlertCircle size={14} style={{ color: '#EF4444' }} /> Urgent: 1 Hour Left
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('results')}
                  style={{ padding: '0.75rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, backgroundColor: '#F8FAFC', cursor: 'pointer', color: '#1E293B', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                  className="preset-btn"
                >
                  <BarChart3 size={14} style={{ color: '#3B82F6' }} /> Publish Final Results
                </button>
              </div>
            </div>

            {/* Composer Box */}
            <div className="card" style={{ padding: '2rem', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.02)' }}>
              <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Channel Selector */}
                <div>
                  <label style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.5rem' }}>
                    Select Dispatch Channel
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <button
                      type="button"
                      onClick={() => setChannel('email')}
                      style={{
                        padding: '1rem 0.5rem',
                        borderRadius: '14px',
                        border: channel === 'email' ? '2.5px solid #2563eb' : '1.5px solid #E2E8F0',
                        backgroundColor: channel === 'email' ? '#EFF6FF' : '#FFFFFF',
                        color: channel === 'email' ? '#2563eb' : '#475569',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Mail size={22} />
                      <span>Email Only</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChannel('sms')}
                      style={{
                        padding: '1rem 0.5rem',
                        borderRadius: '14px',
                        border: channel === 'sms' ? '2.5px solid #2563eb' : '1.5px solid #E2E8F0',
                        backgroundColor: channel === 'sms' ? '#EFF6FF' : '#FFFFFF',
                        color: channel === 'sms' ? '#2563eb' : '#475569',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Smartphone size={22} />
                      <span>SMS Only</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setChannel('both')}
                      style={{
                        padding: '1rem 0.5rem',
                        borderRadius: '14px',
                        border: channel === 'both' ? '2.5px solid #2563eb' : '1.5px solid #E2E8F0',
                        backgroundColor: channel === 'both' ? '#EFF6FF' : '#FFFFFF',
                        color: channel === 'both' ? '#2563eb' : '#475569',
                        fontWeight: 800,
                        fontSize: '0.9rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Zap size={22} />
                      <span>Dual (Email+SMS)</span>
                    </button>
                  </div>
                </div>

                {/* Target Recipient Audience Selector */}
                <div>
                  <label style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.5rem' }}>
                    Target Audience
                  </label>
                  <select
                    value={recipientFilter}
                    onChange={(e: any) => setRecipientFilter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.85rem 1rem',
                      borderRadius: '14px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      backgroundColor: '#F8FAFC',
                      color: '#0F172A',
                      boxSizing: 'border-box',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                    onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                  >
                    <option value="pending">⚡ Batch: Pending Voters (Voters who have NOT cast their ballot yet)</option>
                    <option value="all">👥 Batch: All Roster Voters (Entire Directory)</option>
                    <option value="voted">✅ Batch: Verified Voted Members Only</option>
                    <option value="individual">🎯 Individual: Select Specific Voter(s) from Roster List</option>
                    <option value="custom">✍️ Custom: Input Specific Email Address(es)</option>
                  </select>

                  {/* INDIVIDUAL VOTER SELECTION WIDGET */}
                  {recipientFilter === 'individual' && (
                    <div style={{
                      padding: '1.25rem',
                      borderRadius: '16px',
                      border: '1.5px solid #E2E8F0',
                      backgroundColor: '#F8FAFC',
                      marginTop: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563EB' }}>
                          Selected ({selectedEmails.length} / {rosterVoters.length} Voters)
                        </span>
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                          <button
                            type="button"
                            onClick={handleSelectAllRoster}
                            style={{ border: 'none', background: 'none', color: '#2563EB', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            Select All
                          </button>
                          <span style={{ color: '#94A3B8' }}>|</span>
                          <button
                            type="button"
                            onClick={handleClearSelectedRoster}
                            style={{ border: 'none', background: 'none', color: '#DC2626', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                        <input
                          type="text"
                          placeholder="Search voter by name, email, or student ID..."
                          value={voterSearch}
                          onChange={(e) => setVoterSearch(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.65rem 0.75rem 0.65rem 2.25rem',
                            borderRadius: '10px',
                            border: '1.5px solid #CBD5E1',
                            fontSize: '0.85rem',
                            boxSizing: 'border-box',
                            outline: 'none'
                          }}
                        />
                      </div>

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
                                  backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                                  border: isSelected ? '1.5px solid #BFDBFE' : '1.5px solid #E2E8F0',
                                  fontSize: '0.85rem',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectEmail(v.email.toLowerCase())}
                                  style={{ accentColor: '#2563EB', width: '16px', height: '16px' }}
                                />
                                <div style={{ flex: 1, overflow: 'hidden' }}>
                                  <div style={{ fontWeight: 700, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {v.name} ({v.studentId})
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                  {recipientFilter === 'custom' && (
                    <div style={{ marginTop: '0.75rem' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.4rem' }}>
                        Enter Custom Email Address(es) (separated by commas, semicolons, or newlines)
                      </label>
                      <textarea
                        rows={3}
                        value={customEmailsInput}
                        onChange={(e) => setCustomEmailsInput(e.target.value)}
                        placeholder="e.g. voter1@htu.edu.gh, voter2@htu.edu.gh, observer@gmail.com"
                        style={{
                          width: '100%',
                          padding: '0.85rem 1rem',
                          borderRadius: '14px',
                          border: '1.5px solid #CBD5E1',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit',
                          backgroundColor: '#FFFFFF',
                          color: '#0F172A',
                          boxSizing: 'border-box',
                          outline: 'none',
                          lineHeight: '1.5'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Subject Line (Only for Email or Dual) */}
                {(channel === 'email' || channel === 'both') && (
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.5rem' }}>
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Enter email subject line..."
                      style={{
                        width: '100%',
                        padding: '0.85rem 1rem',
                        borderRadius: '14px',
                        border: '1.5px solid #CBD5E1',
                        fontSize: '0.95rem',
                        fontWeight: 600,
                        backgroundColor: '#FFFFFF',
                        color: '#0F172A',
                        boxSizing: 'border-box',
                        outline: 'none'
                      }}
                    />
                  </div>
                )}

                {/* Message Body Content */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1E293B' }}>
                      Message Body Content
                    </label>

                    {channel !== 'email' && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', backgroundColor: smsChars > 160 ? '#FFE4E6' : '#F1F5F9', color: smsChars > 160 ? '#BE123C' : '#475569' }}>
                        {smsChars} chars • {smsSegments} SMS {smsSegments > 1 ? 'segments' : 'segment'}
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={8}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Type your official announcement content..."
                    style={{
                      width: '100%',
                      padding: '1rem',
                      borderRadius: '16px',
                      border: '1.5px solid #CBD5E1',
                      fontSize: '0.95rem',
                      fontFamily: 'inherit',
                      lineHeight: 1.6,
                      backgroundColor: '#FFFFFF',
                      color: '#0F172A',
                      boxSizing: 'border-box',
                      outline: 'none'
                    }}
                  />

                  {/* Variable Tag Insertion Chips */}
                  <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>Insert Smart Tags:</span>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => handleInsertTag('{{voter_name}}')} style={{ padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                        + Voter Name
                      </button>
                      <button type="button" onClick={() => handleInsertTag('{{index_number}}')} style={{ padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                        + Student ID
                      </button>
                      <button type="button" onClick={() => handleInsertTag('{{voting_link}}')} style={{ padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                        + Voting Ballot Link
                      </button>
                      <button type="button" onClick={() => handleInsertTag('{{election_title}}')} style={{ padding: '0.3rem 0.6rem', borderRadius: '8px', border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', color: '#2563eb', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                        + Election Title
                      </button>
                    </div>
                  </div>
                </div>

                {/* Submit Dispatch Button */}
                <button
                  type="submit"
                  disabled={sending || !body.trim()}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '16px',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '1rem',
                    color: '#FFFFFF',
                    backgroundColor: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    cursor: (sending || !body.trim()) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 6px 20px rgba(37, 99, 235, 0.25)',
                    transition: 'all 0.2s'
                  }}
                  className="dispatch-btn"
                >
                  <Send size={18} />
                  {sending ? 'Dispatching Broadcast Live...' : `Securely Dispatch ${channel.toUpperCase()} Broadcast`}
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: High-Fidelity Live Preview Container */}
          <div style={{ position: 'sticky', top: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '2rem', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.02)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1E293B' }}>
                <Eye size={20} style={{ color: '#2563eb' }} /> High-Fidelity Live Preview Simulation
              </h3>

              {/* simulated email view */}
              {(channel === 'email' || channel === 'both') && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Mail size={14} /> GMAIL / OUTLOOK SIMULATOR
                  </div>

                  <div style={{ border: '1.5px solid #E2E8F0', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '1rem 1.25rem', borderBottom: '1.5px solid #E2E8F0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748B', marginBottom: '0.4rem' }}>
                        <span><strong>From:</strong> HTU Electoral Commission &lt;elections@htu.edu.gh&gt;</span>
                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', backgroundColor: '#E2E8F0', borderRadius: '4px', fontWeight: 700, color: '#475569' }}>SECURE</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        <strong>To:</strong> Kwame Mensah &lt;kwame.mensah@htu.edu.gh&gt;
                      </div>
                    </div>

                    <div style={{ padding: '1.5rem', backgroundColor: '#FFFFFF' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                        {subject || `Important Announcement: ${election.title}`}
                      </div>

                      <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
                        {body
                          .replace(/{{voter_name}}/gi, 'Kwame Mensah')
                          .replace(/{{index_number}}/gi, '0123456789')
                          .replace(/{{election_title}}/gi, election.title)
                          .replace(/{{voting_link}}/gi, `https://htu-elect-aov2.vercel.app/voter/elections/detail?id=${election.id}`)}
                      </div>

                      <div style={{ marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#94A3B8' }}>
                        <Info size={14} />
                        <span>Dispatched securely via HTU Elect EC Broadcast Center.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* simulated SMS view */}
              {(channel === 'sms' || channel === 'both') && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Smartphone size={14} /> SMARTPHONE SMS SIMULATOR
                  </div>

                  <div style={{ maxWidth: '380px', border: '1.5px solid #CBD5E1', borderRadius: '24px', backgroundColor: '#000000', padding: '0.75rem', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
                    <div style={{ backgroundColor: '#1E293B', borderRadius: '18px', padding: '1rem', color: '#FFFFFF', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600, borderBottom: '1px solid #334155', paddingBottom: '0.4rem' }}>
                        HTU ELECT SENDER
                      </div>

                      <div style={{
                        alignSelf: 'flex-start',
                        backgroundColor: '#F1F5F9',
                        color: '#0F172A',
                        padding: '0.75rem 1rem',
                        borderRadius: '16px 16px 16px 4px',
                        fontSize: '0.8rem',
                        lineHeight: 1.4,
                        whiteSpace: 'pre-wrap',
                        maxWidth: '85%'
                      }}>
                        {body
                          .replace(/{{voter_name}}/gi, 'Kwame Mensah')
                          .replace(/{{index_number}}/gi, '0123456789')
                          .replace(/{{election_title}}/gi, election.title)
                          .replace(/{{voting_link}}/gi, `https://htu-elect-aov2.vercel.app/voter/elections/detail?id=${election.id}`)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* TRANSMISSION LOGS TAB: Highly detailed layout */
        <div className="card" style={{ padding: '2rem', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '24px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                Broadcast Transmission Logs
              </h3>
              <p style={{ color: '#64748B', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
                Complete immutable record of all dispatches sent to voters.
              </p>
            </div>

            <div style={{ padding: '0.4rem 0.8rem', borderRadius: '10px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>
              Total Logged Transmissions: {history.length}
            </div>
          </div>

          {history.length === 0 ? (
            <div style={{ padding: '4rem 1.5rem', textAlign: 'center', color: '#64748B' }}>
              <FileText size={48} style={{ color: '#CBD5E1', marginBottom: '1rem' }} />
              <h4 style={{ fontWeight: 800, color: '#475569', margin: '0 0 0.25rem 0' }}>No Dispatches Recorded</h4>
              <p style={{ fontSize: '0.85rem' }}>No broadcast history was found for this election setup yet.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left', borderBottom: '1.5px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569' }}>Date & Time</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569' }}>Channel</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569' }}>Recipients Pool</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569' }}>Content Snapshot</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569' }}>Operator</th>
                    <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569' }}>Transmission Health</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.15s' }} className="hover-row">
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          backgroundColor: log.channel === 'both' ? '#EFF6FF' : log.channel === 'email' ? '#ECFDF5' : '#FFF7ED',
                          color: log.channel === 'both' ? '#2563eb' : log.channel === 'email' ? '#047857' : '#C2410C',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          {log.channel === 'both' ? <Zap size={12} /> : log.channel === 'email' ? <Mail size={12} /> : <Smartphone size={12} />}
                          {log.channel}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 800, color: '#1E293B' }}>
                        {log.recipientCount} Voters
                        <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748B', marginTop: '2px' }}>
                          Filter: <span style={{ textTransform: 'capitalize' }}>{log.recipientFilter}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', maxWidth: '320px' }}>
                        <div style={{ fontWeight: 800, color: '#1E293B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.subject || 'Announcement'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                          {log.body}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>
                        {log.senderEmail}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#047857', fontWeight: 700, padding: '4px 10px', borderRadius: '8px', backgroundColor: '#ECFDF5' }}>
                          <CheckCircle2 size={14} /> Dispatched ({log.emailSentCount} email, {log.smsSentCount} SMS)
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ElectionMessagesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64 text-slate-500 font-medium text-xs">Loading Broadcast Communicator...</div>}>
      <ElectionMessagesContent />
    </Suspense>
  );
}
