'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { 
  ArrowLeft, 
  Upload, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  Mail, 
  Check, 
  Clock, 
  FileText 
} from 'lucide-react';

interface Voter {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone?: string;
  isRegistered?: boolean;
  hasVoted?: boolean;
}

export default function PerElectionVotersPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = React.use(params);
  const electionId = resolvedParams.id;

  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // CSV Upload State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvParsedMembers, setCsvParsedMembers] = useState<any[]>([]);
  const [csvStats, setCsvStats] = useState({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Download Official Voter CSV Template
  const handleDownloadSampleCsv = () => {
    const csvContent = `IndexNumber,FullName,EmailAddress,PhoneNumber,Department
0123456789,Kwame Mensah,kwame.mensah@htu.edu.gh,+233240001122,Computer Science
0123456790,Abena Osei,abena.osei@htu.edu.gh,+233501112233,Electrical Engineering
0123456791,Kofi Annan,kofi.annan@htu.edu.gh,+233273334455,Business Administration`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'htu_elect_voter_roster_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  async function fetchRosterVoters() {
    try {
      setLoading(true);
      const res = await apiRequest<{ status: string; data: Voter[] }>(`/elections/${electionId}/voters`);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setVoters(res.data);
      }
    } catch (err) {
      console.error('Error fetching election voters:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (electionId) fetchRosterVoters();
  }, [electionId]);

  // Handle File Change & Pre-Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      const membersPayload: any[] = [];

      rows.forEach((row, idx) => {
        const cols = row.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length >= 2) {
          const indexNum = cols[0] || '';
          const name = cols[1] || '';
          const email = cols[2] || '';
          const phone = cols[3] || '';
          const department = cols[4] || '';

          const isValidEmail = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

          if (!isValidEmail) {
            invalidCount++;
          } else if (seen.has((indexNum || email).toLowerCase())) {
            duplicateCount++;
          } else {
            seen.add((indexNum || email).toLowerCase());
            validCount++;
            membersPayload.push({
              indexNumber: indexNum,
              studentId: indexNum,
              name,
              email,
              phone,
              phoneNumber: phone,
              department
            });
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
      setCsvParsedMembers(membersPayload);
    };
    reader.readAsText(file);
  };

  // Submit CSV Roster to Server
  const handleUploadRoster = async () => {
    if (!csvParsedMembers || csvParsedMembers.length === 0) return;
    setUploading(true);
    setUploadMessage(null);

    try {
      const res = await apiRequest<{ status: string; message: string; data?: any }>(
        `/elections/${electionId}/voters/upload-csv`,
        'POST',
        { members: csvParsedMembers }
      );

      if (res.status === 'success') {
        setUploadMessage({
          type: 'success',
          text: res.message || `Roster saved! Added ${csvParsedMembers.length} eligible voters with phone numbers to this election.`
        });
        setCsvFile(null);
        setCsvPreview([]);
        setCsvParsedMembers([]);
        setCsvStats({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
        fetchRosterVoters();
      } else {
        throw new Error(res.message || 'Failed to upload roster.');
      }
    } catch (err: any) {
      setUploadMessage({ type: 'error', text: err.message || 'Failed to process CSV file.' });
    } finally {
      setUploading(false);
    }
  };

  const filteredVoters = voters.filter(v => {
    const matchesSearch = v.studentId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'voted') return matchesSearch && v.hasVoted;
    if (statusFilter === 'pending') return matchesSearch && !v.hasVoted;
    return matchesSearch;
  });

  return (
  return (
    <div className="flex flex-col gap-6">
      {/* Banner */}
      <div>
        <Link href={`/admin/elections/${electionId}/dashboard`} className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
          <ArrowLeft size={14} /> Back to Election Command Center
        </Link>
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Election Voter Roster
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
          Manage eligible voters and upload CSV rosters exclusively for this election
        </p>
      </div>

      {/* CSV Roster Upload Section */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-1">
              <Upload size={18} className="text-blue-600 dark:text-blue-400" />
              Upload Election Voter Roster (CSV)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a CSV roster of eligible voters. Required columns: <strong className="text-slate-700 dark:text-slate-300">IndexNumber, FullName, EmailAddress, PhoneNumber, Department</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1.5"
          >
            <FileText size={16} /> Download Sample Voter CSV Template
          </button>
        </div>

        {uploadMessage && (
          <div className={`p-4 rounded-xl text-xs font-semibold mb-4 ${
            uploadMessage.type === 'success' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30' 
              : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30'
          }`}>
            {uploadMessage.text}
          </div>
        )}

        <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center bg-slate-50 dark:bg-slate-900/60">
          <input type="file" accept=".csv" onChange={handleFileChange} className="text-xs font-medium text-slate-600 dark:text-slate-300" />
        </div>

        {/* Live CSV Pre-Validation Box */}
        {csvStats.total > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700/60">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                ✓ {csvStats.valid} Valid Voters
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                ⚠ {csvStats.duplicates} Duplicates
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30">
                ❌ {csvStats.invalid} Invalid Emails
              </span>
            </div>

            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">Live Roster Preview (First 10 Rows)</h4>
            <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl mb-4">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="px-3 py-2">Index No</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {csvPreview.map((row, i) => (
                    <tr key={i} className="text-slate-700 dark:text-slate-300">
                      <td className="px-3 py-2 font-mono font-bold">{row.indexNum}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.phone || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleUploadRoster}
              disabled={uploading || csvStats.valid === 0}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors shadow-md shadow-blue-500/20"
            >
              {uploading ? 'Processing & Saving Roster...' : `Save ${csvStats.valid} Eligible Voters to Election`}
            </button>
          </div>
        )}
      </div>

      {/* Eligible Voter Directory Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Eligible Voters Directory</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">Total Roster: {voters.length} voters</p>
            </div>
            <Link
              href={`/admin/elections/${electionId}/messages`}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-colors flex items-center gap-1.5"
            >
              <Mail size={14} /> Compose SMS/Email Broadcast
            </Link>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search voter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('voted')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === 'voted' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Voted
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  statusFilter === 'pending' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                Pending
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading eligible voters...</p>
        ) : filteredVoters.length === 0 ? (
          <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">No voters found for this election.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700/60">
                <tr>
                  <th className="px-4 py-3">Index Number</th>
                  <th className="px-4 py-3">Full Name</th>
                  <th className="px-4 py-3">Email Address</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Voting Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {filteredVoters.map((v, i) => (
                  <tr key={v.id || i} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">{v.studentId}</td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{v.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{v.email}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{v.phone || 'N/A'}</td>
                    <td className="px-4 py-3">
                      {v.hasVoted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30">
                          <Check size={12} /> Ballot Cast
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30">
                          <Clock size={12} /> Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
