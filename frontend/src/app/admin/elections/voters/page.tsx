'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  FileText, 
  Download 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import DataTable, { type ColumnDef, type FilterDef } from '@/components/DataTable';

interface Voter {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone?: string;
  isRegistered?: boolean;
  hasVoted?: boolean;
}

function PerElectionVotersContent() {
  const searchParams = useSearchParams();
  const electionId = searchParams.get('id') || searchParams.get('electionId') || '';

  const [voters, setVoters] = useState<Voter[]>([]);
  const [loading, setLoading] = useState(true);

  // CSV Upload State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvParsedMembers, setCsvParsedMembers] = useState<any[]>([]);
  const [csvStats, setCsvStats] = useState({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Download Official Voter Excel Template
  const handleDownloadSampleExcel = () => {
    const headers = ['IndexNumber', 'FullName', 'EmailAddress', 'PhoneNumber', 'Program', 'Level'];
    const sampleData = [
      ['0123456789', 'Kwame Mensah', 'kwame.mensah@htu.edu.gh', '+233240001122', 'Computer Science', 'Level 300'],
      ['0123456790', 'Abena Osei', 'abena.osei@htu.edu.gh', '+233501112233', 'Electrical Engineering', 'Level 200'],
      ['0123456791', 'Kofi Annan', 'kofi.annan@htu.edu.gh', '+233273334455', 'Business Administration', 'Level 400'],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Voter Roster');
    XLSX.writeFile(wb, 'htu_elect_voter_roster_template.xlsx');
  };

  async function fetchRosterVoters() {
    if (!electionId) {
      setLoading(false);
      return;
    }
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

  // Handle Excel File Change & Pre-Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (rows.length < 2) return; // header + at least 1 data row

        const headerRow = rows[0].map((h: any) => String(h || '').toLowerCase().trim());
        const dataRows = rows.slice(1).filter((r: any[]) => r.some((c: any) => c !== undefined && c !== ''));

        let validCount = 0;
        let duplicateCount = 0;
        let invalidCount = 0;
        const seen = new Set<string>();
        const parsedPreview: any[] = [];
        const membersPayload: any[] = [];

        dataRows.forEach((row: any[], idx: number) => {
          const get = (field: string) => {
            const aliases: Record<string, string[]> = {
              indexnumber: ['indexnumber', 'index number', 'indexno', 'index_no', 'studentid', 'student id', 'regno', 'reg no'],
              fullname: ['fullname', 'full name', 'name', 'studentname'],
              emailaddress: ['emailaddress', 'email address', 'email', 'emailaddr'],
              phonenumber: ['phonenumber', 'phone number', 'phone', 'phoneNo', 'phone_no', 'mobile'],
              program: ['program', 'programme', 'department', 'dept'],
              level: ['level', 'year', 'yearofstudy']
            };
            const al = aliases[field] || [field];
            for (const a of al) {
              const idx = headerRow.indexOf(a);
              if (idx >= 0 && row[idx] !== undefined && row[idx] !== '') return String(row[idx]).trim();
            }
            return '';
          };

          const indexNum = get('indexnumber');
          const name = get('fullname');
          let email = get('emailaddress');
          const phone = get('phonenumber');
          const program = get('program');
          const level = get('level');

          // Auto-assign @htu.edu.gh if email is missing but index number exists
          if (!email && indexNum) {
            email = indexNum.toLowerCase().trim() + '@htu.edu.gh';
          }

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
              name: name || 'Student',
              email,
              phone,
              phoneNumber: phone,
              program,
              level,
              department: program
            });
          }

          if (idx < 10) {
            parsedPreview.push({ indexNum, name, email, phone, program, level });
          }
        });

        setCsvStats({
          total: dataRows.length,
          valid: validCount,
          duplicates: duplicateCount,
          invalid: invalidCount
        });
        setCsvPreview(parsedPreview);
        setCsvParsedMembers(membersPayload);
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        setCsvStats({ total: 0, valid: 0, duplicates: 0, invalid: 0 });
      }
    };
    reader.readAsArrayBuffer(file);
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

  const voterFilters: FilterDef[] = [{
    key: 'hasVoted',
    label: 'All Status',
    options: [
      { value: 'true', label: 'Voted' },
      { value: 'false', label: 'Pending' },
    ],
  }];

  const voterColumns: ColumnDef<Voter>[] = [
    { key: 'studentId', label: 'Index Number', render: (v) => <span className="font-mono font-bold text-slate-900 dark:text-white">{v.studentId}</span> },
    { key: 'name', label: 'Full Name', render: (v) => <span className="font-bold text-slate-900 dark:text-white">{v.name}</span> },
    { key: 'email', label: 'Email Address', render: (v) => <span className="text-slate-600 dark:text-slate-300">{v.email}</span> },
    { key: 'phone', label: 'Phone', render: (v) => <span className="text-slate-500 dark:text-slate-400">{v.phone || 'N/A'}</span> },
    {
      key: 'hasVoted',
      label: 'Status',
      filterable: true,
      filterKey: 'hasVoted',
      render: (v) => v.hasVoted ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30"><Check size={12} /> Ballot Cast</span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30"><Clock size={12} /> Pending</span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Banner */}
      <div>
        <Link href={`/admin/elections/dashboard?electionId=${electionId}`} className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline mb-3">
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
              Upload Election Voter Roster (Excel)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload an Excel (.xlsx) roster. Required: <strong className="text-slate-700 dark:text-slate-300">IndexNumber, FullName</strong>. Optional: EmailAddress, PhoneNumber, Program, Level. Emails without an address auto-assign @htu.edu.gh.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadSampleExcel}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1.5"
          >
            <FileText size={16} /> Download Excel Template
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
                    <th className="px-3 py-2">Phone</th>\n                    <th className="px-3 py-2">Program</th>\n                    <th className="px-3 py-2">Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {csvPreview.map((row, i) => (
                    <tr key={i} className="text-slate-700 dark:text-slate-300">
                      <td className="px-3 py-2 font-mono font-bold">{row.indexNum}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2">{row.email}</td>
                      <td className="px-3 py-2">{row.phone || 'N/A'}</td>\n                    <td className="px-3 py-2">{row.program || 'N/A'}</td>\n                    <td className="px-3 py-2">{row.level || 'N/A'}</td>
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
              href={`/admin/elections/messages?electionId=${electionId}`}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-colors flex items-center gap-1.5"
            >
              <Mail size={14} /> Compose SMS/Email Broadcast
            </Link>
          </div>

        </div>

        {loading ? (
          <p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading eligible voters...</p>
        ) : (
          <DataTable
            data={voters}
            columns={voterColumns}
            searchPlaceholder="Search by name, index, or email…"
            searchKeys={['studentId', 'name', 'email']}
            filters={voterFilters}
            emptyMessage="No voters found for this election."
            pageSize={10}
          />
        )}
      </div>
    </div>
  );
}

export default function PerElectionVotersPage() {
  return (
    <Suspense fallback={<p className="text-center p-12 text-xs text-slate-500 dark:text-slate-400 font-medium">Loading eligible voters...</p>}>
      <PerElectionVotersContent />
    </Suspense>
  );
}
