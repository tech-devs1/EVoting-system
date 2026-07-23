'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Download, 
  Users, 
  UserCheck, 
  Vote, 
  RefreshCw,
  Search,
  Filter
} from 'lucide-react';

interface ReportSummaryField {
  label: string;
  count: number;
  isSuccessful: boolean;
  mark: string;
}

interface VoterReportItem {
  id: string;
  studentId: string;
  name: string;
  email: string;
  programme: string;
  level: string;
  isRegistered: boolean;
  hasVoted: boolean;
}

interface ReportData {
  summary: {
    field1_totalVoters: ReportSummaryField;
    field2_registeredVoters: ReportSummaryField;
    field3_successfullyVoted: ReportSummaryField;
  };
  totalVotersFromCSV: number;
  totalRegisteredVoters: number;
  totalVoted: number;
  voters: VoterReportItem[];
}

export default function AdminReportPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'registered' | 'voted' | 'unregistered'>('all');

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ status: string; data: ReportData }>('/admin/report', 'GET');
      if (res.status === 'success') {
        setReportData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load report data:', err);
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  // Generate downloadable single file containing summary fields + tick/wrong marks + voter status breakdown
  const downloadReportFile = () => {
    if (!reportData) return;

    const timestamp = new Date().toLocaleString();
    const { summary, voters } = reportData;

    let content = `========================================================================\n`;
    let filename = `COMPSSA_Official_Election_Report_${Date.now()}.txt`;
    
    content += `          COMPSSA E-VOTING SYSTEM - OFFICIAL ELECTION REPORT          \n`;
    content += `========================================================================\n`;
    content += `Generated On : ${timestamp}\n`;
    content += `System Status: ACTIVE & AUDITED\n`;
    content += `------------------------------------------------------------------------\n\n`;

    content += `--- SUMMARY METRICS & FIELD CHECKS ---\n`;
    content += `1. ${summary.field1_totalVoters.label}\n`;
    content += `   Count  : ${summary.field1_totalVoters.count}\n`;
    content += `   Status : [${summary.field1_totalVoters.mark}] ${summary.field1_totalVoters.isSuccessful ? 'SUCCESSFUL FIELD' : 'PENDING FIELD'}\n\n`;

    content += `2. ${summary.field2_registeredVoters.label}\n`;
    content += `   Count  : ${summary.field2_registeredVoters.count}\n`;
    content += `   Status : [${summary.field2_registeredVoters.mark}] ${summary.field2_registeredVoters.isSuccessful ? 'SUCCESSFUL FIELD' : 'PENDING FIELD'}\n\n`;

    content += `3. ${summary.field3_successfullyVoted.label}\n`;
    content += `   Count  : ${summary.field3_successfullyVoted.count}\n`;
    content += `   Status : [${summary.field3_successfullyVoted.mark}] ${summary.field3_successfullyVoted.isSuccessful ? 'SUCCESSFUL FIELD' : 'PENDING FIELD'}\n\n`;

    content += `========================================================================\n`;
    content += `                      DETAILED VOTER ROSTER STATUS                     \n`;
    content += `========================================================================\n`;
    content += `INDEX NUMBER     | NAME                              | REGISTRATION | VOTED STATUS\n`;
    content += `------------------------------------------------------------------------\n`;

    voters.forEach(v => {
      const idx = (v.studentId || '').padEnd(16, ' ');
      const name = (v.name || '').padEnd(33, ' ');
      const reg = v.isRegistered ? '[✓] Registered  ' : '[✗] Unregistered';
      const voted = v.hasVoted ? '[✓] Voted' : '[✗] Not Voted';
      content += `${idx} | ${name} | ${reg} | ${voted}\n`;
    });

    content += `========================================================================\n`;
    content += `End of Official Report - COMPSSA Voting System\n`;

    // Create download blob
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredVoters = (reportData?.voters || []).filter(voter => {
    const matchesSearch = 
      voter.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voter.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      voter.programme.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === 'registered') return voter.isRegistered;
    if (filterStatus === 'unregistered') return !voter.isRegistered;
    if (filterStatus === 'voted') return voter.hasVoted;
    return true;
  });

  return (
    <div className="animate-page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText className="text-primary" size={28} />
            Official Election Report
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-sm)' }}>
            Real-time status overview of voter imports, face/OTP registration, and cast votes
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button 
            onClick={fetchReport} 
            className="btn btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button 
            onClick={downloadReportFile} 
            className="btn btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={loading || !reportData}
          >
            <Download size={16} />
            Export Single File Report
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', border: '1px solid #EF444444' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
          <RefreshCw size={32} className="animate-spin text-primary" style={{ margin: '0 auto 16px auto' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Compiling election report data...</p>
        </div>
      ) : reportData ? (
        <>
          {/* Summary Cards: 3 Required Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)', marginBottom: 'var(--space-8)' }}>
            
            {/* Field 1: Number of Voters (from CSV file) */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', borderLeft: `4px solid ${reportData.summary.field1_totalVoters.isSuccessful ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Field 1
                  </span>
                  <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '4px 0 0 0' }}>
                    {reportData.summary.field1_totalVoters.label}
                  </h3>
                </div>
                <div style={{ 
                  padding: '8px', 
                  borderRadius: 'var(--radius-md)', 
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--color-primary)'
                }}>
                  <Users size={24} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}>
                  {reportData.summary.field1_totalVoters.count}
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>CSV imported records</span>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '8px 12px', 
                borderRadius: 'var(--radius-sm)',
                backgroundColor: reportData.summary.field1_totalVoters.isSuccessful ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: reportData.summary.field1_totalVoters.isSuccessful ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600
              }}>
                {reportData.summary.field1_totalVoters.isSuccessful ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                <span>
                  [{reportData.summary.field1_totalVoters.mark}] {reportData.summary.field1_totalVoters.isSuccessful ? 'Successful Field (Voters Loaded)' : 'Pending Field (No CSV Loaded)'}
                </span>
              </div>
            </div>

            {/* Field 2: Number of Registered Voters */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', borderLeft: `4px solid ${reportData.summary.field2_registeredVoters.isSuccessful ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Field 2
                  </span>
                  <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '4px 0 0 0' }}>
                    {reportData.summary.field2_registeredVoters.label}
                  </h3>
                </div>
                <div style={{ 
                  padding: '8px', 
                  borderRadius: 'var(--radius-md)', 
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--color-success)'
                }}>
                  <UserCheck size={24} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}>
                  {reportData.summary.field2_registeredVoters.count}
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  of {reportData.totalVotersFromCSV} voters registered ({reportData.totalVotersFromCSV > 0 ? Math.round((reportData.summary.field2_registeredVoters.count / reportData.totalVotersFromCSV) * 100) : 0}%)
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '8px 12px', 
                borderRadius: 'var(--radius-sm)',
                backgroundColor: reportData.summary.field2_registeredVoters.isSuccessful ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: reportData.summary.field2_registeredVoters.isSuccessful ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600
              }}>
                {reportData.summary.field2_registeredVoters.isSuccessful ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                <span>
                  [{reportData.summary.field2_registeredVoters.mark}] {reportData.summary.field2_registeredVoters.isSuccessful ? 'Successful Field (Registered Voters Active)' : 'Pending Field (0 Registered Voters)'}
                </span>
              </div>
            </div>

            {/* Field 3: Number of People that have Successfully Voted */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden', borderLeft: `4px solid ${reportData.summary.field3_successfullyVoted.isSuccessful ? 'var(--color-success)' : 'var(--color-danger)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Field 3
                  </span>
                  <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, margin: '4px 0 0 0' }}>
                    {reportData.summary.field3_successfullyVoted.label}
                  </h3>
                </div>
                <div style={{ 
                  padding: '8px', 
                  borderRadius: 'var(--radius-md)', 
                  backgroundColor: 'var(--bg-secondary)',
                  color: '#8B5CF6'
                }}>
                  <Vote size={24} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: 'var(--space-4)' }}>
                <span style={{ fontSize: '32px', fontWeight: 700, letterSpacing: '-1px' }}>
                  {reportData.summary.field3_successfullyVoted.count}
                </span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  ballots cast ({reportData.totalVotersFromCSV > 0 ? Math.round((reportData.summary.field3_successfullyVoted.count / reportData.totalVotersFromCSV) * 100) : 0}% turnout)
                </span>
              </div>

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                padding: '8px 12px', 
                borderRadius: 'var(--radius-sm)',
                backgroundColor: reportData.summary.field3_successfullyVoted.isSuccessful ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: reportData.summary.field3_successfullyVoted.isSuccessful ? 'var(--color-success)' : 'var(--color-danger)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600
              }}>
                {reportData.summary.field3_successfullyVoted.isSuccessful ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                <span>
                  [{reportData.summary.field3_successfullyVoted.mark}] {reportData.summary.field3_successfullyVoted.isSuccessful ? 'Successful Field (Ballots Successfully Recorded)' : 'Pending Field (0 Ballots Cast)'}
                </span>
              </div>
            </div>

          </div>

          {/* Detailed Voter Breakdown Table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0 }}>Voter Verification Roster</h3>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                  Individual field verification checks for all CSV voters
                </p>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: '220px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input 
                    type="text" 
                    placeholder="Search by ID or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      paddingLeft: '36px',
                      paddingRight: '12px',
                      paddingTop: '8px',
                      paddingBottom: '8px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Filter size={16} className="text-secondary" />
                  <select 
                    value={filterStatus} 
                    onChange={(e: any) => setFilterStatus(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)'
                    }}
                  >
                    <option value="all">All Voters</option>
                    <option value="registered">✓ Registered Only</option>
                    <option value="unregistered">✗ Unregistered Only</option>
                    <option value="voted">✓ Voted Only</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Student / Index No.</th>
                    <th style={{ padding: '12px' }}>Full Name</th>
                    <th style={{ padding: '12px' }}>Programme</th>
                    <th style={{ padding: '12px' }}>Level</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Field 2: Registered</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Field 3: Voted</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoters.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No voters match the specified criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredVoters.map((voter, idx) => (
                      <tr key={voter.id} style={{ borderBottom: idx < filteredVoters.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                        <td style={{ padding: '12px', fontWeight: 600 }}>{voter.studentId}</td>
                        <td style={{ padding: '12px' }}>{voter.name}</td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{voter.programme}</td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{voter.level}</td>
                        
                        {/* Registration Field Tick/Cross */}
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {voter.isRegistered ? (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              backgroundColor: 'rgba(16, 185, 129, 0.1)', 
                              color: 'var(--color-success)',
                              fontWeight: 600,
                              fontSize: 'var(--text-xs)'
                            }}>
                              <CheckCircle2 size={14} /> Registered
                            </span>
                          ) : (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                              color: 'var(--color-danger)',
                              fontWeight: 600,
                              fontSize: 'var(--text-xs)'
                            }}>
                              <XCircle size={14} /> Pending
                            </span>
                          )}
                        </td>

                        {/* Voted Field Tick/Cross */}
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {voter.hasVoted ? (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                              color: '#3B82F6',
                              fontWeight: 600,
                              fontSize: 'var(--text-xs)'
                            }}>
                              <CheckCircle2 size={14} /> Voted
                            </span>
                          ) : (
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              padding: '4px 10px', 
                              borderRadius: '20px', 
                              backgroundColor: 'var(--bg-secondary)', 
                              color: 'var(--text-tertiary)',
                              fontWeight: 500,
                              fontSize: 'var(--text-xs)'
                            }}>
                              <XCircle size={14} /> Not Voted
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
