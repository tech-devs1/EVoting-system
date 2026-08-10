'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
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
  HelpCircle,
  BarChart3,
  Eye
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

export default function ElectionMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const electionId = resolvedParams.id;

  const [election, setElection] = useState<Election | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<BroadcastLog[]>([]);

  // Roster Voters & Target Email Selection States
  const [rosterVoters, setRosterVoters] = useState<RosterVoter[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [customEmailsInput, setCustomEmailsInput] = useState('');
  const [voterSearch, setVoterSearch] = useState('');

  // Composer Form States
  const [channel, setChannel] = useState<'both' | 'email' | 'sms'>('both');
  const [recipientFilter, setRecipientFilter] = useState<'all' | 'pending' | 'voted' | 'individual' | 'custom'>('pending');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  useEffect(() => {
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
        if (res.data) setHistory(prev => [res.data!, ...prev]);
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
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading Broadcast Communicator...
      </div>
    );
  }

  return (
    <div className="animate-page-enter">
      {/* Top Banner */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link 
          href={`/admin/elections/${electionId}/dashboard`} 
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', marginBottom: '0.75rem' }}
        >
          <ArrowLeft size={16} /> Back to Election Command Center
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Mail size={28} style={{ color: '#2563eb' }} /> Broadcast Communicator
            </h2>
            <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
              Dispatch Gmail-style Email and SMS broadcast messages directly to election roster voters
            </p>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#F1F5F9', padding: '0.25rem', borderRadius: '12px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('compose')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: activeTab === 'compose' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'compose' ? '#2563eb' : '#64748B',
                boxShadow: activeTab === 'compose' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Send size={15} /> Compose Broadcast
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              style={{
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                border: 'none',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: activeTab === 'history' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'history' ? '#2563eb' : '#64748B',
                boxShadow: activeTab === 'history' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <FileText size={15} /> Transmission Logs ({history.length})
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          backgroundColor: feedback.type === 'success' ? '#F0FDF4' : '#FEF2F2',
          color: feedback.type === 'success' ? '#166534' : '#DC2626',
          border: `1px solid ${feedback.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {feedback.text}
        </div>
      )}

      {activeTab === 'compose' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* LEFT: Gmail-Style Composer Controls */}
          <div className="card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px' }}>
            
            {/* Quick Preset Template Buttons */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
                <Sparkles size={14} style={{ color: '#2563eb' }} /> 1-Click Message Presets
              </label>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleApplyPreset('open')} style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#F8FAFC', cursor: 'pointer', color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Send size={12} /> Voting Open
                </button>
                <button type="button" onClick={() => handleApplyPreset('reminder')} style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#F8FAFC', cursor: 'pointer', color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={12} /> Pending Reminder
                </button>
                <button type="button" onClick={() => handleApplyPreset('closing')} style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#F8FAFC', cursor: 'pointer', color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <AlertCircle size={12} /> 1 Hour Left
                </button>
                <button type="button" onClick={() => handleApplyPreset('results')} style={{ padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#F8FAFC', cursor: 'pointer', color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <BarChart3 size={12} /> Final Results
                </button>
              </div>
            </div>

            <form onSubmit={handleSendBroadcast}>
              
              {/* Channel Selector */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  Dispatch Channel
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setChannel('both')}
                    style={{
                      padding: '0.65rem 0.5rem',
                      borderRadius: '10px',
                      border: channel === 'both' ? '2px solid #2563eb' : '1px solid #E2E8F0',
                      backgroundColor: channel === 'both' ? '#EFF6FF' : '#FFFFFF',
                      color: channel === 'both' ? '#2563eb' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Zap size={15} /> Dual (Email+SMS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('email')}
                    style={{
                      padding: '0.65rem 0.5rem',
                      borderRadius: '10px',
                      border: channel === 'email' ? '2px solid #2563eb' : '1px solid #E2E8F0',
                      backgroundColor: channel === 'email' ? '#EFF6FF' : '#FFFFFF',
                      color: channel === 'email' ? '#2563eb' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Mail size={15} /> Email Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    style={{
                      padding: '0.65rem 0.5rem',
                      borderRadius: '10px',
                      border: channel === 'sms' ? '2px solid #2563eb' : '1px solid #E2E8F0',
                      backgroundColor: channel === 'sms' ? '#EFF6FF' : '#FFFFFF',
                      color: channel === 'sms' ? '#2563eb' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Smartphone size={15} /> SMS Only
                  </button>
                </div>
              </div>

              {/* Target Recipient Audience */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                  Target Recipients
                </label>
                <select
                  value={recipientFilter}
                  onChange={(e: any) => setRecipientFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    backgroundColor: '#F8FAFC',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                    marginBottom: '0.75rem'
                  }}
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
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    marginTop: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563EB' }}>
                        Selected ({selectedEmails.length} / {rosterVoters.length} Voters)
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={handleSelectAllRoster}
                          style={{ border: 'none', background: 'none', color: '#2563EB', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Select All
                        </button>
                        <span style={{ color: '#94A3B8' }}>|</span>
                        <button
                          type="button"
                          onClick={handleClearSelectedRoster}
                          style={{ border: 'none', background: 'none', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
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
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.8rem',
                        marginBottom: '0.65rem',
                        boxSizing: 'border-box'
                      }}
                    />

                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
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
                                gap: '0.5rem',
                                padding: '0.4rem 0.65rem',
                                borderRadius: '6px',
                                backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                                border: isSelected ? '1px solid #BFDBFE' : '1px solid #E2E8F0',
                                fontSize: '0.8rem',
                                cursor: 'pointer'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectEmail(v.email.toLowerCase())}
                                style={{ accentColor: '#2563EB' }}
                              />
                              <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {v.name} ({v.studentId})
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                  <div style={{ marginTop: '0.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                      Enter Custom Email Address(es) (separated by commas or newlines)
                    </label>
                    <textarea
                      rows={3}
                      value={customEmailsInput}
                      onChange={(e) => setCustomEmailsInput(e.target.value)}
                      placeholder="e.g. voter1@htu.edu.gh, voter2@htu.edu.gh, dean@htu.edu.gh"
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        fontSize: '0.85rem',
                        fontFamily: 'inherit',
                        backgroundColor: '#FFFFFF',
                        color: '#0F172A',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Subject Line (For Email & Dual) */}
              {(channel === 'email' || channel === 'both') && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                    Email Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter email subject..."
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      borderRadius: '12px',
                      border: '1px solid #CBD5E1',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      backgroundColor: '#F8FAFC',
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* Message Body Content */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                    Message Content
                  </label>

                  {channel !== 'email' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: smsChars > 160 ? '#E11D48' : '#64748B' }}>
                      {smsChars} chars ({smsSegments} SMS {smsSegments > 1 ? 'segments' : 'segment'})
                    </span>
                  )}
                </div>

                <textarea
                  rows={7}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Type your message content..."
                  style={{
                    width: '100%',
                    padding: '0.85rem 1rem',
                    borderRadius: '12px',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                    backgroundColor: '#F8FAFC',
                    color: '#0F172A',
                    boxSizing: 'border-box'
                  }}
                />

                {/* Variable Tag Insertion Chips */}
                <div style={{ marginTop: '0.65rem' }}>
                  <span style={{ fontSize: '0.725rem', color: '#94A3B8', fontWeight: 700, marginRight: '0.4rem' }}>Insert Dynamic Variables:</span>
                  <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => handleInsertTag('{{voter_name}}')} style={{ padding: '2px 8px', borderRadius: '6px', border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', color: '#2563eb', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer' }}>
                      + Voter Name
                    </button>
                    <button type="button" onClick={() => handleInsertTag('{{index_number}}')} style={{ padding: '2px 8px', borderRadius: '6px', border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', color: '#2563eb', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer' }}>
                      + Index Number
                    </button>
                    <button type="button" onClick={() => handleInsertTag('{{voting_link}}')} style={{ padding: '2px 8px', borderRadius: '6px', border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', color: '#2563eb', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer' }}>
                      + Voting Link
                    </button>
                    <button type="button" onClick={() => handleInsertTag('{{election_title}}')} style={{ padding: '2px 8px', borderRadius: '6px', border: '1px solid #DBEAFE', backgroundColor: '#EFF6FF', color: '#2563eb', fontSize: '0.725rem', fontWeight: 700, cursor: 'pointer' }}>
                      + Election Title
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Dispatch Button */}
              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  backgroundColor: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                }}
              >
                <Send size={18} /> {sending ? 'Dispatching Broadcast...' : `Dispatch ${channel.toUpperCase()} Broadcast Message`}
              </button>
            </form>
          </div>

          {/* RIGHT: Live Gmail-Style Message Preview Box */}
          <div>
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0F172A' }}>
                <Eye size={18} style={{ color: '#2563eb' }} /> Live Gmail & SMS Preview
              </h3>

              {/* Gmail Inbox Simulation Box */}
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#F8FAFC' }}>
                {/* Header Toolbar */}
                <div style={{ backgroundColor: '#2563eb', color: '#FFFFFF', padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Mail size={14} /> Official Email Notification</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.85 }}>HTU Elect Mail Engine</span>
                </div>

                <div style={{ padding: '1.25rem', backgroundColor: '#FFFFFF' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '0.5rem' }}>
                    <strong>From:</strong> HTU Electoral Commission &lt;elections@htu.edu.gh&gt;
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid #F1F5F9' }}>
                    <strong>To:</strong> Kwame Mensah &lt;kwame.mensah@htu.edu.gh&gt; (+233240001122)
                  </div>

                  {(channel === 'email' || channel === 'both') && (
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem' }}>
                      {subject || `Announcement: ${election.title}`}
                    </div>
                  )}

                  <div style={{ fontSize: '0.875rem', color: '#1E293B', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'sans-serif' }}>
                    {body
                      .replace(/{{voter_name}}/gi, 'Kwame Mensah')
                      .replace(/{{index_number}}/gi, '0123456789')
                      .replace(/{{election_title}}/gi, election.title)
                      .replace(/{{voting_link}}/gi, `https://htu-elect-aov2.vercel.app/voter/elections/${election.id}`)}
                  </div>
                </div>
              </div>

              {/* SMS Bubble Preview */}
              {(channel === 'sms' || channel === 'both') && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Smartphone size={14} /> Mobile Phone SMS View
                  </div>
                  <div style={{ backgroundColor: '#E2E8F0', padding: '0.85rem 1.1rem', borderRadius: '16px 16px 16px 4px', fontSize: '0.825rem', color: '#0F172A', lineHeight: 1.4, maxWidth: '90%' }}>
                    {body
                      .replace(/{{voter_name}}/gi, 'Kwame Mensah')
                      .replace(/{{index_number}}/gi, '0123456789')
                      .replace(/{{election_title}}/gi, election.title)
                      .replace(/{{voting_link}}/gi, `https://htu-elect-aov2.vercel.app/voter/elections/${election.id}`)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* TRANSMISSION LOGS TAB */
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0F172A' }}>
            Broadcast Transmission Logs ({history.length})
          </h3>

          {history.length === 0 ? (
            <p style={{ color: '#64748B', textAlign: 'center', padding: '2rem' }}>No broadcast messages sent yet for this election.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Timestamp</th>
                    <th style={{ padding: '10px 14px' }}>Channel</th>
                    <th style={{ padding: '10px 14px' }}>Recipients</th>
                    <th style={{ padding: '10px 14px' }}>Subject / Content</th>
                    <th style={{ padding: '10px 14px' }}>Dispatched By</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((log) => (
                    <tr key={log.id} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#64748B' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          backgroundColor: log.channel === 'both' ? '#EFF6FF' : log.channel === 'email' ? '#F0FDF4' : '#FFF7ED',
                          color: log.channel === 'both' ? '#2563eb' : log.channel === 'email' ? '#166534' : '#C2410C'
                        }}>
                          {log.channel}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                        {log.recipientCount} voters ({log.recipientFilter})
                      </td>
                      <td style={{ padding: '10px 14px', maxWidth: '300px' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.subject}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.body}</div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: '#64748B' }}>
                        {log.senderEmail}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#166534', fontWeight: 700 }}>
                          <CheckCircle2 size={14} /> Dispatched ({log.emailSentCount} emails, {log.smsSentCount} SMS)
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
