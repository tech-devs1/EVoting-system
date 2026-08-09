'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Users, 
  Vote, 
  ArrowRight, 
  FileText, 
  Upload, 
  Sparkles,
  Search,
  Filter,
  Layers,
  ChevronRight,
  TrendingUp,
  ShieldAlert
} from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status: 'draft' | 'scheduled' | 'active' | 'ended';
  startDate: string;
  endDate: string;
  totalVoters?: number;
  totalVotesCast?: number;
  candidateCount?: number;
  positionCount?: number;
}

interface KPIStats {
  totalElections: number;
  totalVoters: number;
  totalVotesCast: number;
  activeElectionsCount: number;
}

export default function OrganizationElectionHub() {
  const router = useRouter();
  const [elections, setElections] = useState<Election[]>([]);
  const [stats, setStats] = useState<KPIStats>({
    totalElections: 0,
    totalVoters: 0,
    totalVotesCast: 0,
    activeElectionsCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');

  // Wizard Modal State
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Executive');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvStats, setCsvStats] = useState({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
  const [isCreating, setIsCreating] = useState(false);
  const [wizardError, setWizardError] = useState('');

  async function fetchHubData() {
    try {
      setLoading(true);
      const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
      if (res.status === 'success' && Array.isArray(res.data)) {
        setElections(res.data);
        
        let voters = 0;
        let votes = 0;
        let active = 0;
        res.data.forEach(e => {
          voters += e.totalVoters || 0;
          votes += e.totalVotesCast || 0;
          if (e.status === 'active') active++;
        });

        setStats({
          totalElections: res.data.length,
          totalVoters: voters,
          totalVotesCast: votes,
          activeElectionsCount: active
        });
      }
    } catch (err) {
      console.error('Error fetching hub data:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHubData();
  }, []);

  // Handle CSV File Selection and Live Pre-Validation
  const handleCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length === 0) return;

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const rows = lines.slice(1);

      let validCount = 0;
      let duplicateCount = 0;
      let invalidCount = 0;
      const seen = new Set<string>();
      const parsedPreview: any[] = [];

      rows.forEach((row, idx) => {
        const cols = row.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length >= 2) {
          const indexNum = cols[0];
          const name = cols[1] || '';
          const email = cols[2] || '';
          const phone = cols[3] || '';

          const isValidEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

          if (!isValidEmail) {
            invalidCount++;
          } else if (seen.has(indexNum.toLowerCase())) {
            duplicateCount++;
          } else {
            seen.add(indexNum.toLowerCase());
            validCount++;
          }

          if (idx < 10) {
            parsedPreview.push({ indexNum, name, email, phone });
          }
        }
      });

      setCsvStats({
        total: rows.length,
        valid: validCount,
        duplicates: duplicateCount,
        invalid: invalidCount
      });
      setCsvPreview(parsedPreview);
    };
    reader.readAsText(file);
  };

  // Submit Wizard Form
  const handleWizardSubmit = async (publishNow: boolean) => {
    setWizardError('');
    if (!title.trim()) {
      setWizardError('Election title is required.');
      setWizardStep(1);
      return;
    }
    if (!startDate || !endDate) {
      setWizardError('Both Start and End dates are required.');
      setWizardStep(2);
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        description: description.trim(),
        startDate,
        endDate,
        status: publishNow ? 'active' : 'draft'
      };

      const res = await apiRequest<{ status: string; data: { id: string } }>('/elections', 'POST', payload);

      if (res.status === 'success' && res.data?.id) {
        const electionId = res.data.id;

        // Upload CSV Roster if provided
        if (csvFile) {
          const formData = new FormData();
          formData.append('file', csvFile);
          await fetch(`/api/elections/${electionId}/upload-roster`, {
            method: 'POST',
            body: formData
          });
        }

        setIsWizardOpen(false);
        resetWizard();
        router.push(`/admin/elections/${electionId}/dashboard`);
      }
    } catch (err: any) {
      setWizardError(err.message || 'Failed to create election.');
    } finally {
      setIsCreating(false);
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setTitle('');
    setCategory('Executive');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setCsvFile(null);
    setCsvPreview([]);
    setWizardError('');
  };

  // Filtered elections
  const filteredElections = elections.filter(e => {
    const matchesStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchesSearch = e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (e.category && e.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span className="pulse-dot"></span> LIVE NOW</span>;
      case 'scheduled':
        return <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> SCHEDULED</span>;
      case 'ended':
        return <span className="badge badge-secondary">CLOSED</span>;
      default:
        return <span className="badge badge-warning">DRAFT</span>;
    }
  };

  return (
    <div className="animate-page-enter">
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Organization Election Hub
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-sm)' }}>
            Manage all organization elections, rosters, and live command centers
          </p>
        </div>
        <button
          onClick={() => { resetWizard(); setIsWizardOpen(true); }}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '12px', fontWeight: 600 }}
        >
          <Plus size={18} /> + Create New Election
        </button>
      </div>

      {/* KPI Cards Bar */}
      <div className="admin-grid-top" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Total Elections</span>
            <span className="kpi-value">{stats.totalElections}</span>
            <div className="kpi-trend"><span>Across organization</span></div>
          </div>
          <div className="kpi-icon-wrapper blue"><Layers size={20} /></div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Active Polls</span>
            <span className="kpi-value" style={{ color: 'var(--color-success)' }}>{stats.activeElectionsCount}</span>
            <div className="kpi-trend up"><span>Live voting in progress</span></div>
          </div>
          <div className="kpi-icon-wrapper green"><CheckCircle2 size={20} /></div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Registered Voters</span>
            <span className="kpi-value">{stats.totalVoters.toLocaleString()}</span>
            <div className="kpi-trend"><span>Across election rosters</span></div>
          </div>
          <div className="kpi-icon-wrapper purple"><Users size={20} /></div>
        </div>

        <div className="card kpi-card">
          <div className="kpi-details">
            <span className="kpi-label">Total Ballots Cast</span>
            <span className="kpi-value">{stats.totalVotesCast.toLocaleString()}</span>
            <div className="kpi-trend up"><TrendingUp size={12} /><span>Cryptographically verified</span></div>
          </div>
          <div className="kpi-icon-wrapper amber"><Vote size={20} /></div>
        </div>
      </div>

      {/* Filter & Toolbar Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Elections' },
            { id: 'active', label: 'Live Now 🟢' },
            { id: 'scheduled', label: 'Scheduled ⏰' },
            { id: 'draft', label: 'Drafts 📝' },
            { id: 'ended', label: 'Closed 🏁' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterStatus === tab.id ? 'var(--color-primary)' : 'var(--bg-input)',
                color: filterStatus === tab.id ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search election title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: '32px',
                paddingRight: '12px',
                paddingTop: '6px',
                paddingBottom: '6px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.85rem',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                width: '220px'
              }}
            />
          </div>
        </div>
      </div>

      {/* Elections Grid View */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading organization elections...
        </div>
      ) : filteredElections.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <Sparkles size={40} style={{ color: 'var(--color-primary)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0 0 0.5rem 0' }}>No Elections Found</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {filterStatus === 'all' ? 'Create your organization\'s first election to launch the election workspace.' : `No elections match the filter "${filterStatus}".`}
          </p>
          <button onClick={() => { resetWizard(); setIsWizardOpen(true); }} className="btn btn-primary">
            + Create New Election
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredElections.map(election => {
            const turnout = (election.totalVoters && election.totalVoters > 0)
              ? Math.min(100, Math.round(((election.totalVotesCast || 0) / election.totalVoters) * 100))
              : 0;

            return (
              <div 
                key={election.id} 
                className="card"
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justify: 'space-between',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  border: '1px solid var(--border-color)',
                  transition: 'all 0.25s ease',
                  position: 'relative'
                }}
              >
                <div>
                  {/* Category Pill & Status Badge */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-primary)',
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      {election.category || 'Executive'}
                    </span>
                    {getStatusBadge(election.status)}
                  </div>

                  {/* Election Title */}
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {election.title}
                  </h3>

                  {/* Scheduled Window */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                    <Calendar size={14} />
                    <span>
                      {new Date(election.startDate).toLocaleDateString()} ➔ {new Date(election.endDate).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Turnout Progress Bar */}
                  <div style={{ backgroundColor: 'var(--bg-input)', borderRadius: '8px', padding: '0.85rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Live Voter Turnout</span>
                      <span style={{ color: 'var(--text-primary)' }}>{turnout}% ({election.totalVotesCast || 0} / {election.totalVoters || 0})</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${turnout}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: '999px', transition: 'width 0.4s ease' }}></div>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button -> Enters Dedicated Workspace */}
                <Link
                  href={`/admin/elections/${election.id}/dashboard`}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}
                >
                  <span>Manage Election</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* 4-Step Election Creation Wizard Modal */}
      {isWizardOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          padding: '1.5rem'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', borderRadius: '20px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            
            {/* Modal Header & Step Indicator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>Create New Election</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Step {wizardStep} of 4</p>
              </div>
              <button onClick={() => setIsWizardOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-tertiary)' }}>✕</button>
            </div>

            {/* Step Progress Bar */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }}>
              {[1, 2, 3, 4].map(step => (
                <div key={step} style={{ flex: 1, height: '4px', backgroundColor: step <= wizardStep ? 'var(--color-primary)' : 'var(--border-color)', borderRadius: '999px' }} />
              ))}
            </div>

            {wizardError && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid #fecaca' }}>
                {wizardError}
              </div>
            )}

            {/* STEP 1: General Details */}
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Election Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. COMPSSA Executive Elections 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Category / Type</label>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['Executive', 'Departmental', 'Student Council', 'General Assembly', 'Board'].map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        style={{
                          padding: '0.5rem 0.85rem',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          border: category === cat ? '1.5px solid var(--color-primary)' : '1px solid var(--border-color)',
                          backgroundColor: category === cat ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-input)',
                          color: category === cat ? 'var(--color-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Description & Voter Guidelines</label>
                  <textarea
                    rows={3}
                    placeholder="Provide guidelines for eligible voters..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            )}

            {/* STEP 2: Scheduling */}
            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>End Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  />
                </div>

                <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-input)', borderRadius: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  🌐 Timezone: <strong>GMT / UTC+0 (Accra)</strong>. Access will open and close strictly at these timestamps.
                </div>
              </div>
            )}

            {/* STEP 3: CSV Roster Pre-Validation */}
            {wizardStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Upload Eligible Voter CSV Roster</label>
                  <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', backgroundColor: 'var(--bg-input)' }}>
                    <Upload size={32} style={{ color: 'var(--color-primary)', marginBottom: '0.5rem' }} />
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>Drop your CSV file here or click to browse</p>
                    <input type="file" accept=".csv" onChange={handleCsvChange} style={{ fontSize: '0.85rem' }} />
                  </div>
                </div>

                {csvStats.total > 0 && (
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-success">✓ {csvStats.valid} Valid Voters</span>
                      <span className="badge badge-warning">⚠ {csvStats.duplicates} Duplicates</span>
                      <span className="badge badge-danger">❌ {csvStats.invalid} Invalid Emails</span>
                    </div>

                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>CSV Preview (First 10 Rows)</h4>
                    <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-input)', textAlign: 'left' }}>
                            <th style={{ padding: '6px 10px' }}>Index No</th>
                            <th style={{ padding: '6px 10px' }}>Name</th>
                            <th style={{ padding: '6px 10px' }}>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '6px 10px', fontFamily: 'monospace' }}>{row.indexNum}</td>
                              <td style={{ padding: '6px 10px' }}>{row.name}</td>
                              <td style={{ padding: '6px 10px' }}>{row.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Review & Launch */}
            {wizardStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>{title || 'Untitled Election'}</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0' }}>Category: <strong>{category}</strong></p>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div><strong>Start Window:</strong> {startDate ? new Date(startDate).toLocaleString() : 'Not Set'}</div>
                    <div><strong>End Window:</strong> {endDate ? new Date(endDate).toLocaleString() : 'Not Set'}</div>
                    <div><strong>Uploaded Roster:</strong> {csvStats.valid} eligible voters</div>
                  </div>
                </div>
              </div>
            )}

            {/* Wizard Navigation Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              {wizardStep > 1 ? (
                <button type="button" onClick={() => setWizardStep(wizardStep - 1)} className="btn btn-outline">
                  Back
                </button>
              ) : <div />}

              {wizardStep < 4 ? (
                <button type="button" onClick={() => setWizardStep(wizardStep + 1)} className="btn btn-primary">
                  Next Step ➔
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => handleWizardSubmit(false)}
                    className="btn btn-outline"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => handleWizardSubmit(true)}
                    className="btn btn-primary"
                    style={{ fontWeight: 700 }}
                  >
                    {isCreating ? 'Creating Workspace...' : '🚀 Launch Election Workspace'}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
