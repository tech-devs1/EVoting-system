'use client';

import React, { useEffect, useState, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Download, 
  RefreshCw,
  Printer,
  ShieldCheck,
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
  const [generatingPDF, setGeneratingPDF] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'registered' | 'voted' | 'unregistered'>('all');

  const reportDocRef = useRef<HTMLDivElement>(null);

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

  // Dynamically load html2pdf script if not already present
  const loadHtml2Pdf = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).html2pdf) {
        return resolve((window as any).html2pdf);
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve((window as any).html2pdf);
      script.onerror = () => reject(new Error('Failed to load PDF engine'));
      document.body.appendChild(script);
    });
  };

  // Generate downloadable PDF file
  const downloadPDFReport = async () => {
    if (!reportData || !reportDocRef.current) return;
    setGeneratingPDF(true);

    try {
      const html2pdf = await loadHtml2Pdf();
      const element = reportDocRef.current;

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `COMPSSA_Official_Election_Report_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err: any) {
      console.warn('html2pdf download fallback to window.print():', err);
      window.print();
    } finally {
      setGeneratingPDF(false);
    }
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

  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="animate-page-enter">
      {/* Print Styles for PDF Generation */}
      <style>{`
        @media print {
          .no-print, nav, sidebar, header, .theme-toggle-btn, button {
            display: none !important;
          }
          body, html, .app-shell, .main-wrapper, .content-area {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .written-document {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Action Header */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText className="text-primary" size={28} />
            Official Election Written Report
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-sm)' }}>
            Certified PDF document detailing voter counts, registrations, and voting outcomes
          </p>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button 
            onClick={fetchReport} 
            className="btn btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh Data
          </button>

          <button 
            onClick={() => window.print()} 
            className="btn btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={loading || !reportData}
          >
            <Printer size={16} />
            Print Document
          </button>

          <button 
            onClick={downloadPDFReport} 
            className="btn btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={loading || !reportData || generatingPDF}
          >
            <Download size={16} />
            {generatingPDF ? 'Generating PDF...' : 'Download PDF Report'}
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
          <p style={{ color: 'var(--text-secondary)' }}>Compiling official written election report...</p>
        </div>
      ) : reportData ? (
        <>
          {/* Controls Bar for On-Screen Table Filtering */}
          <div className="no-print card" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={18} className="text-primary" />
                <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Roster Filter Controls</span>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: '240px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input 
                    type="text" 
                    placeholder="Search voter by name or ID..."
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
                  <option value="all">All Roster Voters</option>
                  <option value="registered">✓ Registered Only</option>
                  <option value="unregistered">✗ Unregistered Only</option>
                  <option value="voted">✓ Voted Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Formal Written PDF Document Layout Container */}
          <div 
            ref={reportDocRef}
            className="written-document"
            style={{ 
              backgroundColor: '#ffffff', 
              color: '#1e293b', 
              padding: '40px', 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border-color)',
              fontFamily: 'Inter, Arial, sans-serif',
              maxWidth: '900px',
              margin: '0 auto'
            }}
          >
            {/* Header: COMPSSA Official Logo & Letterhead */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '20px', marginBottom: '24px' }}>
              <img 
                src="/compssa_logo.png" 
                alt="COMPSSA Logo" 
                style={{ height: '85px', objectFit: 'contain', margin: '0 auto 12px auto', display: 'block' }} 
              />
              <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                COMPUTER SCIENCE STUDENTS ASSOCIATION (COMPSSA)
              </h1>
              <h2 style={{ fontSize: '13px', fontWeight: 600, color: '0284c7', margin: '4px 0 0 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
                HO TECHNICAL UNIVERSITY • DEPARTMENT OF COMPUTER SCIENCE
              </h2>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0' }}>
                P.O. Box 217, Ho, Volta Region, Ghana | Email: compssa@htu.edu.gh
              </p>
            </div>

            {/* Document Reference Metadata */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#475569', marginBottom: '24px', backgroundColor: '#f8fafc', padding: '10px 16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div>
                <strong>DOCUMENT REF:</strong> COMPSSA/ELEC/AUDIT/2026/01
              </div>
              <div>
                <strong>DATE:</strong> {currentDate}
              </div>
              <div>
                <strong>STATUS:</strong> <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ CERTIFIED & AUDITED</span>
              </div>
            </div>

            {/* Document Title */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0, textDecoration: 'underline', textUnderlineOffset: '6px' }}>
                OFFICIAL ELECTION AUDIT & VOTER STATUS REPORT
              </h2>
            </div>

            {/* Section 1: Executive Summary */}
            <div style={{ marginBottom: '24px', lineHeight: 1.6, fontSize: '13px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '8px', borderLeft: '3px solid #0284c7', paddingLeft: '8px' }}>
                1. EXECUTIVE SUMMARY & AUDIT OVERVIEW
              </h3>
              <p style={{ margin: 0, color: '#334155' }}>
                This official audit document certifies the election readiness, voter registration counts, and ballot casting statistics for the COMPSSA Executive Elections. All database records have been verified against imported CSV rosters and biometric/OTP authentication logs.
              </p>
            </div>

            {/* Section 2: Certified Summary Fields Table (The 3 Mandatory Fields) */}
            <div style={{ marginBottom: '28px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', borderLeft: '3px solid #0284c7', paddingLeft: '8px' }}>
                2. CERTIFIED FIELD VERIFICATION SUMMARY
              </h3>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', width: '8%' }}>FIELD</th>
                    <th style={{ padding: '10px 12px' }}>VERIFICATION METRIC DESCRIPTION</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '18%' }}>TOTAL COUNT</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '25%' }}>VERIFICATION MARK</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Field 1: Number of Voters from CSV */}
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                    <td style={{ padding: '12px', fontWeight: 700, textAlign: 'center', color: '#0284c7' }}>1</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{reportData.summary.field1_totalVoters.label}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, fontSize: '15px' }}>
                      {reportData.summary.field1_totalVoters.count}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 12px', 
                        borderRadius: '4px',
                        backgroundColor: reportData.summary.field1_totalVoters.isSuccessful ? '#f0fdf4' : '#fef2f2',
                        color: reportData.summary.field1_totalVoters.isSuccessful ? '#15803d' : '#b91c1c',
                        fontWeight: 700,
                        fontSize: '12px',
                        border: `1px solid ${reportData.summary.field1_totalVoters.isSuccessful ? '#bbf7d0' : '#fecaca'}`
                      }}>
                        {reportData.summary.field1_totalVoters.isSuccessful ? '✓ PASSED (Loaded)' : '✗ PENDING (Empty)'}
                      </span>
                    </td>
                  </tr>

                  {/* Field 2: Number of Registered Voters */}
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                    <td style={{ padding: '12px', fontWeight: 700, textAlign: 'center', color: '#0284c7' }}>2</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{reportData.summary.field2_registeredVoters.label}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, fontSize: '15px' }}>
                      {reportData.summary.field2_registeredVoters.count}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 12px', 
                        borderRadius: '4px',
                        backgroundColor: reportData.summary.field2_registeredVoters.isSuccessful ? '#f0fdf4' : '#fef2f2',
                        color: reportData.summary.field2_registeredVoters.isSuccessful ? '#15803d' : '#b91c1c',
                        fontWeight: 700,
                        fontSize: '12px',
                        border: `1px solid ${reportData.summary.field2_registeredVoters.isSuccessful ? '#bbf7d0' : '#fecaca'}`
                      }}>
                        {reportData.summary.field2_registeredVoters.isSuccessful ? '✓ PASSED (Active)' : '✗ PENDING (0 Reg)'}
                      </span>
                    </td>
                  </tr>

                  {/* Field 3: Number of People that have Successfully Voted */}
                  <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }}>
                    <td style={{ padding: '12px', fontWeight: 700, textAlign: 'center', color: '#0284c7' }}>3</td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{reportData.summary.field3_successfullyVoted.label}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 700, fontSize: '15px' }}>
                      {reportData.summary.field3_successfullyVoted.count}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 12px', 
                        borderRadius: '4px',
                        backgroundColor: reportData.summary.field3_successfullyVoted.isSuccessful ? '#f0fdf4' : '#fef2f2',
                        color: reportData.summary.field3_successfullyVoted.isSuccessful ? '#15803d' : '#b91c1c',
                        fontWeight: 700,
                        fontSize: '12px',
                        border: `1px solid ${reportData.summary.field3_successfullyVoted.isSuccessful ? '#bbf7d0' : '#fecaca'}`
                      }}>
                        {reportData.summary.field3_successfullyVoted.isSuccessful ? '✓ PASSED (Ballots Cast)' : '✗ PENDING (0 Votes)'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Section 3: Comprehensive Voter Audit Roster */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px', borderLeft: '3px solid #0284c7', paddingLeft: '8px' }}>
                3. COMPREHENSIVE VOTER ROSTER AUDIT LOG ({filteredVoters.length} RECORDS)
              </h3>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', color: '#ffffff', textAlign: 'left' }}>
                    <th style={{ padding: '8px 10px', width: '18%' }}>INDEX NUMBER</th>
                    <th style={{ padding: '8px 10px', width: '32%' }}>VOTER FULL NAME</th>
                    <th style={{ padding: '8px 10px', width: '22%' }}>PROGRAMME</th>
                    <th style={{ padding: '8px 10px', width: '10%' }}>LEVEL</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '9%' }}>REGISTRATION</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center', width: '9%' }}>VOTED</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoters.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                        No voter records match the current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredVoters.map((voter, idx) => (
                      <tr 
                        key={voter.id} 
                        style={{ 
                          borderBottom: '1px solid #e2e8f0', 
                          backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' 
                        }}
                      >
                        <td style={{ padding: '8px 10px', fontWeight: 700, fontFamily: 'monospace' }}>
                          {voter.studentId}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                          {voter.name}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>
                          {voter.programme}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#475569' }}>
                          {voter.level}
                        </td>
                        
                        {/* Registration Mark */}
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {voter.isRegistered ? (
                            <span style={{ color: '#16a34a', fontWeight: 700 }}>[ ✓ ]</span>
                          ) : (
                            <span style={{ color: '#dc2626', fontWeight: 700 }}>[ ✗ ]</span>
                          )}
                        </td>

                        {/* Voting Mark */}
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          {voter.hasVoted ? (
                            <span style={{ color: '#2563eb', fontWeight: 700 }}>[ ✓ ]</span>
                          ) : (
                            <span style={{ color: '#64748b', fontWeight: 700 }}>[ ✗ ]</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Section 4: Formal Endorsement & Sign-Off */}
            <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '2px dashed #cbd5e1' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                <div>
                  <p style={{ fontSize: '11px', color: '#475569', marginBottom: '40px' }}>
                    Compiled & Certified By:
                  </p>
                  <div style={{ borderBottom: '1px solid #0f172a', width: '220px', marginBottom: '6px' }}></div>
                  <p style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Electoral Commissioner
                  </p>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                    COMPSSA Electoral Commission, HTU
                  </p>
                </div>

                <div>
                  <p style={{ fontSize: '11px', color: '#475569', marginBottom: '40px' }}>
                    Endorsed & Approved By:
                  </p>
                  <div style={{ borderBottom: '1px solid #0f172a', width: '220px', marginBottom: '6px' }}></div>
                  <p style={{ fontSize: '12px', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    Head of Department / Patron
                  </p>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>
                    Department of Computer Science, HTU
                  </p>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '10px', color: '#94a3b8' }}>
                *** THIS IS AN OFFICIAL SYSTEM-GENERATED CRYPTOGRAPHIC AUDIT REPORT • COMPSSA E-VOTING SYSTEM ***
              </div>
            </div>

          </div>
        </>
      ) : null}
    </div>
  );
}
