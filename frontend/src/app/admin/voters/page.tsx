'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { UploadCloud, FileType, CheckCircle, AlertTriangle, Users, Eye, Trash2, Calendar, FileDown, RefreshCw } from 'lucide-react';

interface ParsedVoter {
  id: string;
  name: string;
  programme: string;
  level: string;
  email: string;
  phone?: string;
}

interface UploadHistoryItem {
  id: string;
  filename: string;
  timestamp: number;
  added: number;
  skipped: number;
}

interface UnsuccessfulVoter extends ParsedVoter {
  reason: string;
}

interface VoterRecord {
  id: string;
  name: string;
  studentId: string;
  email: string;
  programme: string;
  level: string;
  phone?: string;
  isRegistered: boolean;
  uploadId?: string;
}

export default function AdminVotersPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'roster'>('upload');

  // Upload and parsing states
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedVoter[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [unsuccessfulRecords, setUnsuccessfulRecords] = useState<UnsuccessfulVoter[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History states
  const [uploadsHistory, setUploadsHistory] = useState<UploadHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Enrolled voters roster state
  const [voters, setVoters] = useState<VoterRecord[]>([]);
  const [totalVotersCount, setTotalVotersCount] = useState(0);
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch upload history
  const fetchUploadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiRequest<{ status: string; data: UploadHistoryItem[] }>('/admin/voters/uploads');
      if (res.status === 'success') {
        setUploadsHistory(res.data);
      }
    } catch (err) {
      console.error('Failed to load upload history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch enrolled voters roster
  const fetchVoters = async (query = searchQuery, pageNum = page) => {
    setLoadingVoters(true);
    try {
      const qParam = query ? `&search=${encodeURIComponent(query)}` : '';
      const res = await apiRequest<{
        status: string;
        data: { voters: VoterRecord[]; total: number; page: number; totalPages: number };
      }>(`/admin/voters?page=${pageNum}&limit=25${qParam}`);
      if (res.status === 'success') {
        setVoters(res.data.voters || []);
        setTotalVotersCount(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
        setPage(res.data.page || 1);
      }
    } catch (err) {
      console.error('Failed to load voters roster:', err);
    } finally {
      setLoadingVoters(false);
    }
  };

  useEffect(() => {
    fetchUploadHistory();
    fetchVoters();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseCSV(selectedFile);
      // Clear previous upload results
      setUnsuccessfulRecords([]);
      setMessage(null);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const rawLines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim() !== '');
      if (rawLines.length < 2) {
        setMessage({ type: 'error', text: 'CSV file is empty or has only one row.' });
        return;
      }

      const data: ParsedVoter[] = [];

      // Remove surrounding quotes / apostrophes / whitespace
      const clean = (s: string): string =>
        s ? s.replace(/^["'\s\t]+|["'\s\t]+$/g, '').trim() : '';

      // Pick the most-frequent separator character
      const detectDelim = (line: string): string => {
        const c: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
        for (const ch of line) if (ch in c) c[ch]++;
        return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0];
      };
      const delim = rawLines.length > 0 ? detectDelim(rawLines[0]) : ',';

      // Split one CSV line honouring quoted fields
      const splitLine = (line: string): string[] => {
        const out: string[] = [];
        let inQ = false, cur = '';
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ; }
          else if (ch === delim && !inQ) { out.push(clean(cur)); cur = ''; }
          else { cur += ch; }
        }
        out.push(clean(cur));
        return out;
      };

      // Purely-numeric 6-14 digit string → student ID
      const isId   = (s: string) => /^\d{6,14}$/.test(s);
      // Contains level keyword or 100/200/300/400 pattern
      const isLvl  = (s: string) => /level|lvl/i.test(s) || /^[1-4]00$/.test(s);
      // Contains an academic programme keyword
      const isProg = (s: string) => {
        const l = s.toLowerCase();
        return ['btech','b.tech','bsc','b.sc','hnd','msc','phd','computer','engineering',
                'science','business','ict','technology','accounting','management',
                'education','nursing','health','information','mathematics',
                'statistics','economics','arts','law','commerce'].some(k => l.includes(k));
      };
      // Looks like a phone number (7-15 digits, may start with +/0)
      const isPhone = (s: string) => /^[+]?[\d\s\-().]{7,15}$/.test(s.trim()) && /\d{7,}/.test(s.replace(/[\s\-().+]/g, ''));

      // ── HEADER SCAN ──────────────────────────────────────────────────────
      let startRow = 0;
      let hIdx = -1, hSur = -1, hFirst = -1, hFull = -1, hProg = -1, hLvl = -1, hEmail = -1, hPhone = -1;

      const row0 = splitLine(rawLines[0]).map(c => c.toLowerCase());
      const isHeaderRow = row0.some(c =>
        ['index','surname','name','programme','level','student','id','email','phone','mobile','contact','telephone'].some(k => c.includes(k))
      );

      if (isHeaderRow) {
        startRow = 1;
        row0.forEach((col, i) => {
          const c = col.replace(/\s+/g, ' ').trim();
          if (['index no','index','student id','student no','matric','id'].some(k => c.includes(k))) hIdx   = i;
          else if (['surname','last name','family name'].some(k => c.includes(k)))                   hSur   = i;
          else if (['first name','other name','given name','firstname','othername'].some(k => c.includes(k))) hFirst = i;
          else if (['full name','fullname'].some(k => c.includes(k)) || c === 'name')               hFull  = i;
          else if (['programme','program','course'].some(k => c.includes(k)))                        hProg  = i;
          else if (['level','lvl','year'].some(k => c.includes(k)))                                  hLvl   = i;
          else if (c.includes('email'))                                                              hEmail = i;
          else if (['phone','mobile','contact','telephone','tel','cell'].some(k => c.includes(k)))  hPhone = i;
        });
      }

      // Fallback programme = filename (without extension, underscores → spaces)
      const fallback = file.name.replace(/\.(csv|xlsx|txt)$/i, '').replace(/_/g, ' ').trim();

      // ── DATA ROWS ────────────────────────────────────────────────────────
      for (let i = startRow; i < rawLines.length; i++) {
        const cols = splitLine(rawLines[i]);
        if (cols.filter(Boolean).length < 2) continue;

        let idx = '', name = '', prog = '', lvl = '', email = '', phone = '';

        // PATH A – header column positions known
        if (hIdx !== -1) {
          idx = cols[hIdx] || '';

          if (hFull !== -1 && cols[hFull]) {
            name = cols[hFull] || '';
          } else if (hSur !== -1 && hFirst !== -1) {
            const s = cols[hSur] || '', f = cols[hFirst] || '';
            name = s && f ? `${s}, ${f}` : (s || f);
          } else {
            // Collect all columns that are not ID / programme / level / email / phone
            name = cols
              .filter((_, ci) => ci !== hIdx && ci !== hProg && ci !== hLvl && ci !== hEmail && ci !== hPhone)
              .filter(v => v && !isId(v) && !isLvl(v) && !isProg(v) && !isPhone(v))
              .join(', ');
          }
          prog  = hProg  !== -1 ? (cols[hProg]  || '') : '';
          lvl   = hLvl   !== -1 ? (cols[hLvl]   || '') : '';
          email = hEmail !== -1 ? (cols[hEmail]  || '') : '';
          phone = hPhone !== -1 ? (cols[hPhone]  || '') : '';
        }

        // PATH B – no header mapping; auto-detect columns
        if (!idx) {
          // Find student ID: first purely-numeric 6-14 digit field
          let idCol = -1;
          for (let c = 0; c < cols.length; c++) {
            if (isId(cols[c])) { idCol = c; break; }
          }
          if (idCol === -1) continue; // no student ID in this row — skip

          idx = cols[idCol];
          const rest = cols.filter((_, c) => c !== idCol);

          // Extract phone number
          let ph = '';
          const noPhone = rest.filter(v => {
            if (!ph && isPhone(v)) { ph = v; return false; }
            return true;
          });
          phone = ph;

          // Extract level value
          let lv = '';
          const noLvl = noPhone.filter(v => {
            if (!lv && isLvl(v)) { lv = v; return false; }
            return true;
          });
          lvl = lv;

          // Extract programme (search right-to-left for keyword match)
          let pr = '', prI = -1;
          for (let c = noLvl.length - 1; c >= 0; c--) {
            if (isProg(noLvl[c])) { pr = noLvl[c]; prI = c; break; }
          }
          prog = pr;

          // Name = everything remaining (in original CSV order)
          name = noLvl.filter((_, c) => c !== prI).filter(Boolean).join(', ');
        }

        // ── FALLBACKS & CLEANUP ─────────────────────────────────────────
        if (!prog) prog = fallback;
        idx  = idx.replace(/^["'\s,]+|["'\s,]+$/g, '').trim();
        name = name.replace(/^["'\s,]+|["'\s,]+$/g, '').trim();
        
        // Ensure index number starts with '0' if numeric (e.g., 325050184 -> 0325050184)
        if (idx && !idx.startsWith('0') && /^\d+$/.test(idx)) {
          idx = '0' + idx;
        }

        if (!email) {
          email = `${idx}@htu.edu.gh`;
        } else {
          email = email.replace(/^["'\s,]+|["'\s,]+$/g, '').trim();
          // Ensure email local part starts with '0' if numeric
          const [localPart, domain] = email.split('@');
          if (localPart && !localPart.startsWith('0') && /^\d+$/.test(localPart)) {
            email = `0${localPart}@${domain || 'htu.edu.gh'}`;
          }
        }

        // Clean phone number
        const phoneClean = phone.replace(/^["'\s,]+|["'\s,]+$/g, '').trim();

        if (idx && name) {
          data.push({ id: idx, name, programme: prog, level: lvl, email, phone: phoneClean });
        }
      }

      setParsedData(data);
    };

    reader.onerror = () => setMessage({ type: 'error', text: 'Failed to read the CSV file.' });
    reader.readAsText(file);
  };



  const handleUpload = async () => {
    if (parsedData.length === 0 || !file) {
      setMessage({ type: 'error', text: 'No valid data found to upload.' });
      return;
    }

    setUploading(true);
    setMessage(null);
    setUnsuccessfulRecords([]);

    try {
      const res = await apiRequest<{
        status: string;
        message: string;
        data: { added: number; skipped: number; unsuccessful: UnsuccessfulVoter[] };
      }>('/admin/voters/bulk', 'POST', {
        filename: file.name,
        voters: parsedData
      });
      
      if (res.status === 'success') {
        const { added, skipped, unsuccessful } = res.data;
        
        if (unsuccessful && unsuccessful.length > 0) {
          setUnsuccessfulRecords(unsuccessful);
          setMessage({
            type: 'warning',
            text: `Import complete. Added ${added} voters. ${unsuccessful.length} records were unsuccessful (e.g. duplicates).`
          });
        } else {
          setMessage({
            type: 'success',
            text: `Successfully imported ${added} voters from ${file.name}.`
          });
        }

        // Reset file uploader input state for next file
        setFile(null);
        setParsedData([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Refresh upload history and roster list
        fetchUploadHistory();
        fetchVoters();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred during upload.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUpload = async (uploadId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? All associated voters will be permanently removed from the database.`)) {
      return;
    }

    try {
      const res = await apiRequest<{ status: string; message: string }>(`/admin/voters/uploads/${uploadId}`, 'DELETE');
      if (res.status === 'success') {
        // Refresh history and voters
        fetchUploadHistory();
        fetchVoters();
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete upload.');
    }
  };

  const handleClearDatabase = async () => {
    if (!confirm('WARNING: This will permanently delete ALL voters, upload history, and registered voters from the database. This action cannot be undone. Are you sure you want to completely clear the voter database?')) {
      return;
    }

    try {
      const res = await apiRequest<{ status: string; message: string }>('/admin/voters/clear', 'POST');
      if (res.status === 'success') {
        fetchUploadHistory();
        fetchVoters();
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to clear database.');
    }
  };

  const downloadUnsuccessfulCSV = () => {
    if (unsuccessfulRecords.length === 0) return;

    // Build CSV file contents
    const headers = ['Index Number', 'Full Name', 'Programme', 'Level', 'Reason'];
    const rows = unsuccessfulRecords.map(rec => [
      rec.id,
      `"${rec.name.replace(/"/g, '""')}"`,
      rec.programme,
      rec.level,
      `"${rec.reason.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `unsuccessful_voters_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, margin: 0 }}>Voter Database</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-sm)' }}>
            Bulk import, view, and manage eligible voter rosters
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <button 
            className="btn btn-outline" 
            onClick={handleClearDatabase}
            style={{ 
              borderColor: 'var(--color-danger)', 
              color: 'var(--color-danger)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Trash2 size={16} /> Clear Database
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', borderBottom: '1px solid var(--border-color)', paddingBottom: 'var(--space-2)' }}>
        <button
          onClick={() => setActiveTab('upload')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            backgroundColor: activeTab === 'upload' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'upload' ? '#FFFFFF' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <UploadCloud size={16} /> Upload & Files History
        </button>
        <button
          onClick={() => { setActiveTab('roster'); fetchVoters(); }}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 'var(--text-sm)',
            backgroundColor: activeTab === 'roster' ? 'var(--color-primary)' : 'transparent',
            color: activeTab === 'roster' ? '#FFFFFF' : 'var(--text-secondary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease'
          }}
        >
          <Users size={16} /> Enrolled Students ({totalVotersCount})
        </button>
      </div>

      {activeTab === 'upload' ? (
        <div className="admin-voters-grid">
          
          {/* Upload Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0, width: '100%' }}>
            {/* Upload Form Card */}
            <div className="card">
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} className="text-primary" />
                Upload Voter Roster
              </h3>
              
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
                Upload CSV rosters of eligible voters. Multiple files can be uploaded sequentially.
                <br />
                <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                  * Target columns: <code>Index Number, fullname(surname,first name), programme, level</code>. Phone numbers are ignored.
                </span>
              </p>

              <div 
                style={{ 
                  border: '2px dashed var(--border-color)', 
                  borderRadius: 'var(--radius-lg)', 
                  padding: 'var(--space-8)', 
                  textAlign: 'center',
                  marginBottom: 'var(--space-6)',
                  backgroundColor: 'var(--bg-secondary)'
                }}
              >
                <UploadCloud size={48} style={{ color: 'var(--color-primary)', margin: '0 auto var(--space-4) auto' }} />
                <p style={{ fontWeight: 500, marginBottom: 'var(--space-2)' }}>Select a CSV file to upload</p>
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileChange} 
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <FileType size={16} /> Browse Files
                </label>
              </div>

              {file && (
                <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-6)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileType size={16} className="text-primary" /> {file.name}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                      {(file.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    Parsed <strong>{parsedData.length}</strong> voter records from selected file.
                  </p>
                </div>
              )}

              {message && (
                <div style={{ 
                  padding: 'var(--space-4)', 
                  borderRadius: 'var(--radius-md)', 
                  marginBottom: 'var(--space-6)', 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : message.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: message.type === 'success' ? '#10B981' : message.type === 'warning' ? '#D97706' : '#EF4444',
                  border: `1px solid ${message.type === 'success' ? '#10B98144' : message.type === 'warning' ? '#F59E0B44' : '#EF444444'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                    <span>{message.text}</span>
                  </div>

                  {unsuccessfulRecords.length > 0 && (
                    <button 
                      onClick={downloadUnsuccessfulCSV} 
                      className="btn btn-outline" 
                      style={{ 
                        marginTop: 'var(--space-2)', 
                        borderColor: '#D97706', 
                        color: '#D97706', 
                        width: 'fit-content',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: 'var(--text-xs)'
                      }}
                    >
                      <FileDown size={14} /> Download Unsuccessful Records (CSV)
                    </button>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => {
                    setFile(null);
                    setParsedData([]);
                    setMessage(null);
                    setUnsuccessfulRecords([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  disabled={uploading || !file}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleUpload}
                  disabled={uploading || parsedData.length === 0}
                >
                  {uploading ? 'Processing...' : 'Upload Data'}
                </button>
              </div>
            </div>

            {/* Import Preview panel (if file selected) */}
            {parsedData.length > 0 && (
              <div className="card animate-fade-in" style={{ maxHeight: '350px', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
                <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={20} className="text-primary" />
                  Previewing Roster (First 5 records)
                </h3>
                <div style={{ overflowX: 'auto', flexGrow: 1, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>Index Number</th>
                        <th style={{ padding: '8px 12px' }}>Full Name</th>
                        <th style={{ padding: '8px 12px' }}>Email</th>
                        <th style={{ padding: '8px 12px' }}>Programme</th>
                        <th style={{ padding: '8px 12px' }}>Level</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 5).map((voter, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < parsedData.slice(0, 5).length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{voter.id}</td>
                          <td style={{ padding: '8px 12px' }}>{voter.name}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{voter.email}</td>
                          <td style={{ padding: '8px 12px' }}>{voter.programme}</td>
                          <td style={{ padding: '8px 12px' }}>{voter.level}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedData.length > 5 && (
                  <p style={{ margin: 'var(--space-2) 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    + {parsedData.length - 5} more records...
                  </p>
                )}
              </div>
            )}
          </div>

          {/* History Column */}
          <div className="card" style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Calendar size={20} className="text-primary" />
                Upload History
              </h3>
              <button 
                onClick={fetchUploadHistory} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
                title="Refresh History"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', lineHeight: 1.4 }}>
              List of imported CSV rosters. Deleting a file permanently removes its rostered voters.
            </p>

            <div style={{ overflowX: 'auto', flexGrow: 1, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
              {loadingHistory ? (
                <p style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading history...</p>
              ) : uploadsHistory.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>No file uploads recorded yet.</p>
                  {totalVotersCount > 0 && (
                    <p style={{ color: 'var(--color-primary)', fontWeight: 500, fontSize: 'var(--text-sm)' }}>
                      Note: {totalVotersCount} active students are currently loaded in this department's database. Click "Enrolled Students" tab to view.
                    </p>
                  )}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px' }}>Filename / Source</th>
                      <th style={{ padding: '12px' }}>Upload Date</th>
                      <th style={{ padding: '12px' }}>Enrolled Voters</th>
                      <th style={{ padding: '12px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadsHistory.map((upload, idx) => (
                      <tr key={upload.id} style={{ borderBottom: idx < uploadsHistory.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                        <td style={{ padding: '12px', fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={upload.filename}>
                          {upload.filename}
                        </td>
                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(upload.timestamp).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '12px' }}>
                          <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>{upload.added}</span> / <span style={{ color: 'var(--text-secondary)' }}>{upload.skipped}</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          {upload.id !== 'primary_roster' ? (
                            <button 
                              onClick={() => handleDeleteUpload(upload.id, upload.filename)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--color-danger)',
                                padding: '4px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Delete file and associated voters"
                            >
                              <Trash2 size={16} />
                            </button>
                          ) : (
                            <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* Enrolled Voters Roster Tab */
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} className="text-primary" />
                Department Enrolled Voters ({totalVotersCount})
              </h3>
              <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                All student records loaded and eligible to vote in this department.
              </p>
            </div>
            
            {/* Search Input */}
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search index no, name, or programme..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchVoters(e.target.value, 1);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'inherit',
                  fontSize: 'var(--text-sm)',
                  minWidth: '280px'
                }}
              />
              <button
                onClick={() => fetchVoters(searchQuery, 1)}
                className="btn btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
                title="Refresh Roster"
              >
                <RefreshCw size={14} /> Refresh
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            {loadingVoters ? (
              <p style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading voter roster...</p>
            ) : voters.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <p>No voter records found{searchQuery ? ` matching "${searchQuery}"` : ''}.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Index Number</th>
                    <th style={{ padding: '12px' }}>Full Name</th>
                    <th style={{ padding: '12px' }}>Programme</th>
                    <th style={{ padding: '12px' }}>Level</th>
                    <th style={{ padding: '12px' }}>Email</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Registration Status</th>
                  </tr>
                </thead>
                <tbody>
                  {voters.map((voter) => (
                    <tr key={voter.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>{voter.studentId || voter.id}</td>
                      <td style={{ padding: '12px' }}>{voter.name}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{voter.programme || '—'}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{voter.level || '—'}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{voter.email || '—'}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          backgroundColor: voter.isRegistered ? 'rgba(16, 185, 129, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                          color: voter.isRegistered ? '#10B981' : 'var(--text-secondary)'
                        }}>
                          {voter.isRegistered ? 'Registered' : 'Rostered'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages} ({totalVotersCount} total voters)
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => fetchVoters(searchQuery, page - 1)}
                  disabled={page <= 1}
                  style={{ padding: '4px 12px', fontSize: 'var(--text-xs)' }}
                >
                  Previous
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => fetchVoters(searchQuery, page + 1)}
                  disabled={page >= totalPages}
                  style={{ padding: '4px 12px', fontSize: 'var(--text-xs)' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
