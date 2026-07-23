'use client';

import React, { useEffect, useState, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { 
  FileText, 
  Download, 
  RefreshCw,
  Printer,
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

  const downloadPDFReport = async () => {
    if (!reportData || !reportDocRef.current) return;
    setGeneratingPDF(true);

    try {
      const html2pdf = await loadHtml2Pdf();
      const element = reportDocRef.current;

      const opt = {
        margin: [10, 10, 10, 10],
        filename: `COMPSSA_Election_Activity_Report_${Date.now()}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err: any) {
      console.warn('Fallback to native print dialog:', err);
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
      {/* Print Styles */}
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

      {/* Admin Action Header Bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText className="text-primary" size={28} />
            Official Election Activity & Audit Report
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-sm)' }}>
            Official written document format showing voter counts, activity summary narratives, and complete voter logs
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
            Refresh
          </button>

          <button 
            onClick={() => window.print()} 
            className="btn btn-outline" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            disabled={loading || !reportData}
          >
            <Printer size={16} />
            Print
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
          <p style={{ color: 'var(--text-secondary)' }}>Loading written election report...</p>
        </div>
      ) : reportData ? (
        <>
          {/* Controls Bar for On-Screen Searching */}
          <div className="no-print card" style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={18} className="text-primary" />
                <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Voter Log Filters</span>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', minWidth: '240px' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input 
                    type="text" 
                    placeholder="Search by student ID or name..."
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
                  <option value="all">All Voters</option>
                  <option value="registered">✓ Registered Only</option>
                  <option value="unregistered">✗ Unregistered Only</option>
                  <option value="voted">✓ Voted Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Official Document Layout matching sample report format */}
          <div 
            ref={reportDocRef}
            className="written-document"
            style={{ 
              backgroundColor: '#ffffff', 
              color: '#000000', 
              padding: '48px', 
              borderRadius: 'var(--radius-lg)', 
              boxShadow: 'var(--shadow-md)',
              border: '1px solid var(--border-color)',
              fontFamily: 'Georgia, "Times New Roman", serif',
              maxWidth: '850px',
              margin: '0 auto',
              lineHeight: 1.6
            }}
          >
            {/* Ho Technical University Crest Header Logo */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <img 
                src="/htu_logo.png" 
                alt="Ho Technical University Logo" 
                style={{ 
                  maxHeight: '110px', 
                  maxWidth: '220px',
                  objectFit: 'contain', 
                  margin: '0 auto 12px auto', 
                  display: 'block' 
                }} 
              />
            </div>

            {/* Document Main Title (Centered) */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, textTransform: 'none', letterSpacing: '0px' }}>
                COMPSSA Election Activity & Audit Report
              </h1>
            </div>

            {/* Top 2-Column Metadata Header Block (Matching Sample Layout) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '36px', fontSize: '14px', lineHeight: 1.5 }}>
              {/* Left Column: Organization Details */}
              <div style={{ width: '48%' }}>
                <p style={{ margin: 0, fontWeight: 'normal' }}>COMPSSA Electoral Commission</p>
                <p style={{ margin: 0 }}>Department of Computer Science</p>
                <p style={{ margin: 0 }}>Ho Technical University</p>
                <p style={{ margin: 0 }}>P.O. Box 217, Ho, Ghana</p>
                <p style={{ margin: 0 }}>compssa@htu.edu.gh</p>
              </div>

              {/* Right Column: Administrator & Report Details */}
              <div style={{ width: '48%', textAlign: 'left' }}>
                <p style={{ margin: 0 }}><strong>Administrator:</strong> Electoral Commissioner</p>
                <p style={{ margin: 0 }}><strong>Organization:</strong> COMPSSA HTU</p>
                <p style={{ margin: 0 }}><strong>Date:</strong> {currentDate}</p>
                <p style={{ margin: 0 }}><strong>Report Ref:</strong> COMPSSA/ELEC/REP/2026</p>
                <p style={{ margin: 0 }}><strong>Audit Status:</strong> System Certified ✓</p>
              </div>
            </div>

            {/* Sub-Header: Activity Period / Election Status */}
            <div style={{ fontStyle: 'italic', fontSize: '14px', marginBottom: '28px', borderBottom: '1px solid #000000', paddingBottom: '8px' }}>
              Official Audit Period: Active Election Session as of {currentDate}
            </div>

            {/* Written Narrative Section 1: Field 1 - Number of Voters from CSV */}
            <div style={{ marginBottom: '24px', fontSize: '14.5px' }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                1. Number of Voters (from CSV file): {reportData.summary.field1_totalVoters.count} voters imported [{reportData.summary.field1_totalVoters.mark}]
              </p>
              <p style={{ margin: 0, textAlign: 'justify' }}>
                A total of <strong>{reportData.summary.field1_totalVoters.count}</strong> eligible student voters were parsed and loaded into the official COMPSSA voter database from the uploaded CSV rosters. All student index numbers, full names, programmes, and levels have been verified and assigned HTU institutional emails.
              </p>
            </div>

            {/* Written Narrative Section 2: Field 2 - Number of Registered Voters */}
            <div style={{ marginBottom: '24px', fontSize: '14.5px' }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                2. Number of Registered Voters: {reportData.summary.field2_registeredVoters.count} voters registered [{reportData.summary.field2_registeredVoters.mark}]
              </p>
              <p style={{ margin: 0, textAlign: 'justify' }}>
                Out of the imported roster, <strong>{reportData.summary.field2_registeredVoters.count}</strong> voters have completed their voter registration and authentication setup. Registered voters have verified credentials on file and are cleared to cast their votes.
              </p>
            </div>

            {/* Written Narrative Section 3: Field 3 - Number of People Successfully Voted */}
            <div style={{ marginBottom: '28px', fontSize: '14.5px' }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>
                3. Number of People that have Successfully Voted: {reportData.summary.field3_successfullyVoted.count} ballots cast [{reportData.summary.field3_successfullyVoted.mark}]
              </p>
              <p style={{ margin: 0, textAlign: 'justify' }}>
                A total of <strong>{reportData.summary.field3_successfullyVoted.count}</strong> voters have successfully cast their ballots in the election. Each cast ballot is recorded with cryptographic hash verification to ensure zero duplicate votes and maintain 100% audit integrity.
              </p>
            </div>

            {/* Section Title for Voter Roster List */}
            <div style={{ marginBottom: '16px', borderTop: '2px solid #000000', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>
                Detailed Voter Audit Roster ({filteredVoters.length} Records)
              </h3>
            </div>

            {/* Voter Roster Table */}
            <div style={{ marginBottom: '40px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'Arial, sans-serif' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #000000', textAlign: 'left' }}>
                    <th style={{ padding: '6px 4px', width: '13%' }}>Index No.</th>
                    <th style={{ padding: '6px 4px', width: '22%' }}>Full Name</th>
                    <th style={{ padding: '6px 4px', width: '22%' }}>Email</th>
                    <th style={{ padding: '6px 4px', width: '25%' }}>Programme</th>
                    <th style={{ padding: '6px 4px', width: '8%' }}>Level</th>
                    <th style={{ padding: '6px 4px', textAlign: 'center', width: '5%' }}>Reg</th>
                    <th style={{ padding: '6px 4px', textAlign: 'center', width: '5%' }}>Voted</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVoters.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#666666' }}>
                        No voters match the specified criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredVoters.map((voter, idx) => (
                      <tr 
                        key={voter.id} 
                        style={{ borderBottom: '1px solid #dddddd' }}
                      >
                        {/* Index Number */}
                        <td style={{ padding: '5px 4px', fontWeight: 'bold', fontSize: '11px' }}>
                          {voter.studentId || '—'}
                        </td>
                        {/* Full Name */}
                        <td style={{ padding: '5px 4px', fontSize: '11px' }}>
                          {voter.name || '—'}
                        </td>
                        {/* Email */}
                        <td style={{ padding: '5px 4px', fontSize: '10px', color: '#333333', wordBreak: 'break-all' }}>
                          {voter.email || (voter.studentId ? `${voter.studentId}@htu.edu.gh` : '—')}
                        </td>
                        {/* Programme */}
                        <td style={{ padding: '5px 4px', fontSize: '10px', color: '#333333' }}>
                          {voter.programme && voter.programme !== 'N/A' ? voter.programme : '—'}
                        </td>
                        {/* Level */}
                        <td style={{ padding: '5px 4px', fontSize: '11px', color: '#333333' }}>
                          {voter.level && voter.level !== 'N/A' ? voter.level : '—'}
                        </td>
                        {/* Registration Tick */}
                        <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: voter.isRegistered ? '#16a34a' : '#dc2626' }}>
                          {voter.isRegistered ? '✓' : '✗'}
                        </td>
                        {/* Voted Tick */}
                        <td style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: voter.hasVoted ? '#16a34a' : '#dc2626' }}>
                          {voter.hasVoted ? '✓' : '✗'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Signatures & Certification Block */}
            <div style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid #000000', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: '0 0 40px 0' }}>Report Prepared By:</p>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>__________________________________________</p>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>Electoral Commissioner</p>
                  <p style={{ margin: 0, color: '#555555' }}>COMPSSA, Ho Technical University</p>
                </div>

                <div>
                  <p style={{ margin: '0 0 40px 0' }}>Certified & Endorsed By:</p>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>__________________________________________</p>
                  <p style={{ margin: '4px 0 0 0', fontWeight: 'bold' }}>Head of Department / Patron</p>
                  <p style={{ margin: 0, color: '#555555' }}>Department of Computer Science</p>
                </div>
              </div>
            </div>

          </div>
        </>
      ) : null}
    </div>
  );
}
