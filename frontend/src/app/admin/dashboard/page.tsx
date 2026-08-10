'use client';

import React, { useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { 
  Plus, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  Users, 
  Vote, 
  ArrowRight, 
  Upload, 
  Sparkles,
  Search,
  Layers,
  Settings,
  Zap,
  TrendingUp,
  LogOut
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
  const { user, logout } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const adminName = user?.name?.split(' ')[0] || 'Admin';

  return (
    <div className="animate-page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      
      {/* Justadmin Hero Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#0F172A', letterSpacing: '-0.025em' }}>
            Hi, {adminName}
          </h1>
          <p style={{ fontSize: '0.95rem', color: '#64748B', margin: '0.25rem 0 0 0' }}>
            Welcome back to HTU Elect Dashboard!
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => window.print()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: '#FFFFFF',
              color: '#475569',
              border: '1px solid #E2E8F0',
              borderRadius: '14px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
          >
            <Upload size={16} /> Download Report
          </button>

          <button
            onClick={() => { resetWizard(); setIsWizardOpen(true); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '14px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
            }}
          >
            <Plus size={18} /> + Add Election
          </button>
        </div>
      </div>

      {/* 4 KPI Stat Cards Row (Card 1 is Primary Blue) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        
        {/* Card 1: Primary Blue */}
        <div style={{
          backgroundColor: '#2563EB',
          color: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.35)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.9, display: 'block', marginBottom: '0.5rem' }}>Live Elections</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>{stats.activeElectionsCount}</span>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <Zap size={22} />
          </div>
        </div>

        {/* Card 2: Total Elections */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.5rem' }}>Total Elections</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>{stats.totalElections}</span>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#2563EB'
          }}>
            <Layers size={22} />
          </div>
        </div>

        {/* Card 3: Registered Voters */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.5rem' }}>Registered Voters</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>{stats.totalVoters.toLocaleString()}</span>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#F5F3FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#7C3AED'
          }}>
            <Users size={22} />
          </div>
        </div>

        {/* Card 4: Turnout Rate */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '0.5rem' }}>Total Votes Cast</span>
            <span style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>{stats.totalVotesCast.toLocaleString()}</span>
          </div>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            backgroundColor: '#ECFDF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#10B981'
          }}>
            <Vote size={22} />
          </div>
        </div>

      </div>

      {/* Analytics Visual Grid Row (Bar Chart + Doughnut Breakdown) */}
      <div className="dashboard-analytics-grid" style={{ gap: '1.25rem' }}>
        
        {/* Voting Activity Bar Chart Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Overall Voting Activity</span>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {stats.totalVotesCast.toLocaleString()} Votes
              </h3>
            </div>
            <div style={{ padding: '0.35rem 0.85rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={14} /> Aug 08 - Aug 14
            </div>
          </div>

          {/* Visual Bar Chart Height Indicators */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '140px', paddingTop: '1rem', borderBottom: '1px solid #F1F5F9' }}>
            {[
              { day: 'Mon', height: '40%', active: false },
              { day: 'Tue', height: '65%', active: false },
              { day: 'Wed', height: '50%', active: false },
              { day: 'Thu', height: '90%', active: true },
              { day: 'Fri', height: '75%', active: false },
              { day: 'Sat', height: '80%', active: false }
            ].map((bar, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                <div style={{
                  width: '36px',
                  height: bar.height,
                  backgroundColor: bar.active ? '#2563EB' : '#E2E8F0',
                  borderRadius: '10px',
                  transition: 'height 0.3s ease',
                  boxShadow: bar.active ? '0 4px 12px rgba(37, 99, 235, 0.3)' : 'none'
                }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8' }}>{bar.day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Voter Turnout Doughnut Breakdown Card */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '1.5rem',
          border: '1px solid #E2E8F0',
          boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Voter Turnout</h4>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Live Roster</span>
          </div>

          {/* Donut Graphic */}
          <div style={{ position: 'relative', width: '130px', height: '130px', margin: '1rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="130" height="130" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <path stroke="#E2E8F0" strokeWidth="4" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path stroke="#2563EB" strokeWidth="4.5" strokeDasharray="85, 100" strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', display: 'block', lineHeight: 1 }}>88%</span>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Participation</span>
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#64748B', textAlign: 'center', fontWeight: 500 }}>
            88% higher turnout than last session
          </div>
        </div>

      </div>

      {/* Elections Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All Elections (${elections.length})` },
            { id: 'active', label: 'Live Now 🟢' },
            { id: 'scheduled', label: 'Scheduled ⏰' },
            { id: 'draft', label: 'Drafts 📝' },
            { id: 'ended', label: 'Closed 🏁' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterStatus === tab.id ? '#2563EB' : '#F1F5F9',
                color: filterStatus === tab.id ? '#FFFFFF' : '#475569',
                transition: 'all 0.2s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search election title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '38px',
              paddingRight: '14px',
              paddingTop: '9px',
              paddingBottom: '9px',
              borderRadius: '12px',
              border: '1px solid #E2E8F0',
              fontSize: '0.875rem',
              backgroundColor: '#FFFFFF',
              color: '#0F172A',
              width: '240px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Elections Cards Grid View */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
          Loading organization elections...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          
          {/* Create New Election Dashed Action Card */}
          <div 
            onClick={() => { resetWizard(); setIsWizardOpen(true); }}
            style={{ 
              border: '2px dashed #2563EB',
              borderRadius: '20px',
              padding: '2rem 1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              backgroundColor: 'rgba(37, 99, 235, 0.03)',
              transition: 'all 0.25s ease',
              minHeight: '260px'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#DBEAFE',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Plus size={28} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: '#0F172A' }}>
              Create New Election
            </h3>
            <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0, maxWidth: '220px' }}>
              Launch a new election workspace and set up voter rosters
            </p>
          </div>

          {/* Active Election Cards */}
          {filteredElections.map(election => {
            const turnout = (election.totalVoters && election.totalVoters > 0)
              ? Math.min(100, Math.round(((election.totalVotesCast || 0) / election.totalVoters) * 100))
              : 0;

            return (
              <div 
                key={election.id}
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'space-between',
                  borderRadius: '20px',
                  padding: '1.5rem',
                  border: '1px solid #E2E8F0',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.04)',
                  minHeight: '260px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      fontWeight: 700, 
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: '#2563EB',
                      backgroundColor: '#EFF6FF',
                      padding: '3px 10px',
                      borderRadius: '8px'
                    }}>
                      {election.category || 'Executive'}
                    </span>
                    {getStatusBadge(election.status)}
                  </div>

                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0F172A', lineHeight: 1.3 }}>
                    {election.title}
                  </h3>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: '#64748B', marginBottom: '1.25rem' }}>
                    <Calendar size={14} />
                    <span>
                      {new Date(election.startDate).toLocaleDateString()} ➔ {new Date(election.endDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '0.85rem', marginBottom: '1.25rem', border: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                      <span style={{ color: '#64748B' }}>Voter Turnout</span>
                      <span style={{ color: '#0F172A' }}>{turnout}% ({election.totalVotesCast || 0} / {election.totalVoters || 0})</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${turnout}%`, height: '100%', backgroundColor: '#2563EB', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                </div>

                <Link
                  href={`/admin/elections/${election.id}/dashboard`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.85rem',
                    borderRadius: '14px',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  <Zap size={16} />
                  <span>Open Workspace</span>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* 4-Step Election Creation Wizard Modal */}
      <Modal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        title="Create New Election"
        subtitle={`Step ${wizardStep} of 4`}
        maxWidth="640px"
      >
        {/* Step Progress Bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }}>
          {[1, 2, 3, 4].map(step => (
            <div key={step} style={{ flex: 1, height: '4px', backgroundColor: step <= wizardStep ? '#2563EB' : '#E2E8F0', borderRadius: '999px' }} />
          ))}
        </div>

        {wizardError && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1.25rem', border: '1px solid #fecaca' }}>
            {wizardError}
          </div>
        )}

        {/* STEP 1: Basic Info */}
        {wizardStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Election Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. 2026 HTU SRC General Elections"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Category / Faculty Scope</label>
              <input
                type="text"
                placeholder="e.g. SRC, Executive, Faculty of Engineering"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Detailed Description</label>
              <textarea
                rows={3}
                placeholder="Provide voter instructions or eligibility rules..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>
        )}

        {/* STEP 2: Schedule */}
        {wizardStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Poll Opening Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem' }}>Poll Closing Date & Time *</label>
              <input
                type="datetime-local"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
            </div>

            <div style={{ backgroundColor: 'var(--color-primary-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--color-primary-200)', color: 'var(--color-primary-700)', fontSize: '0.85rem' }}>
              ℹ️ Once opened, polls operate automatically according to schedule. You can adjust times before launch.
            </div>
          </div>
        )}

        {/* STEP 3: Upload Roster */}
        {wizardStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
              Upload an optional CSV roster of eligible voters (`IndexNumber, FullName, Email`):
            </p>
            
            <div style={{ border: '2px dashed var(--border-color)', padding: '1.5rem', borderRadius: '12px', textAlign: 'center', backgroundColor: 'var(--bg-input)' }}>
              <input
                type="file"
                accept=".csv"
                id="wizard-csv-input"
                style={{ display: 'none' }}
                onChange={handleCsvChange}
              />
              <label htmlFor="wizard-csv-input" style={{ cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={32} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {csvFile ? csvFile.name : 'Click to select CSV File'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Format: IndexNumber, FullName, Email</span>
              </label>
            </div>

            {csvStats.total > 0 && (
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, padding: '0.75rem', backgroundColor: '#ecfdf5', color: '#047857', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center' }}>
                  <strong>{csvStats.valid}</strong> Valid Voters
                </div>
                <div style={{ flex: 1, padding: '0.75rem', backgroundColor: '#fef3c7', color: '#b45309', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center' }}>
                  <strong>{csvStats.duplicates}</strong> Duplicates
                </div>
                <div style={{ flex: 1, padding: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '8px', fontSize: '0.8rem', textAlign: 'center' }}>
                  <strong>{csvStats.invalid}</strong> Invalid Rows
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Review & Launch */}
        {wizardStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.75rem 0', color: '#0F172A' }}>Election Summary</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div><strong>Title:</strong> {title || 'Untitled'}</div>
                <div><strong>Scope:</strong> {category || 'General'}</div>
                <div><strong>Start:</strong> {startDate ? new Date(startDate).toLocaleString() : 'Not Set'}</div>
                <div><strong>End:</strong> {endDate ? new Date(endDate).toLocaleString() : 'Not Set'}</div>
                <div><strong>Roster:</strong> {csvStats.valid} eligible voters uploaded</div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.25rem', borderTop: '1px solid #F1F5F9' }}>
          <button
            type="button"
            disabled={wizardStep === 1}
            onClick={() => setWizardStep(prev => prev - 1)}
            style={{ padding: '0.7rem 1.25rem', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: wizardStep === 1 ? 'not-allowed' : 'pointer', opacity: wizardStep === 1 ? 0.5 : 1 }}
          >
            Back
          </button>

          {wizardStep < 4 ? (
            <button
              type="button"
              onClick={() => setWizardStep(prev => prev + 1)}
              style={{ padding: '0.7rem 1.25rem', borderRadius: '14px', border: 'none', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}
            >
              Next Step ➔
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => handleWizardSubmit(false)}
                style={{ padding: '0.7rem 1.25rem', borderRadius: '14px', border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Save Draft
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => handleWizardSubmit(true)}
                style={{ padding: '0.7rem 1.25rem', borderRadius: '14px', border: 'none', backgroundColor: '#2563EB', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}
              >
                {isCreating ? 'Creating Workspace...' : '🚀 Launch Workspace'}
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
