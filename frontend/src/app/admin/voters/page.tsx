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

export default function AdminVotersPage() {
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

  // Fetch upload history
  const fetchUploadHistory = async () => {
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

  useEffect(() => {
    fetchUploadHistory();
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

      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      const data: ParsedVoter[] = [];

      // Strip surrounding quotes and whitespace
      const clean = (s: string) => s.replace(/^["'\s]+|["'\s]+$/g, '').trim();

      // Parse a CSV line respecting quoted fields
      const parseLine = (lineText: string): string[] => {
        const cols: string[] = [];
        let inQuote = false;
        let cur = '';
        for (let j = 0; j < lineText.length; j++) {
          const ch = lineText[j];
          if (ch === '"') { inQuote = !inQuote; }
          else if (ch === ',' && !inQuote) { cols.push(clean(cur)); cur = ''; }
          else { cur += ch; }
        }
        cols.push(clean(cur));
        return cols;
      };

      // Is this value a student index number? (pure digits, 6-12 chars)
      const isIndexNumber = (s: string) => /^\d{6,12}$/.test(s);

      // Is this value a level?
      const isLevel = (s: string) => {
        if (!s) return false;
        const sl = s.toLowerCase();
        return sl.includes('level') || sl.includes('lvl') || /^[1-4]00$/.test(s);
      };

      // Is this a phone number AND not an index number?
      // Phone numbers usually have spaces, dashes, or a + prefix, or are 11+ digits
      const isPhoneNotIndex = (s: string) =>
        /^\+/.test(s) ||              // starts with +
        /[\s\-]/.test(s) ||           // has spaces or dashes
        /^\d{11,}$/.test(s);          // more than 10 digits (unlikely to be index)

      // Skip header row
      let startIndex = 0;
      if (lines.length > 0) {
        const fl = lines[0].toLowerCase();
        if (fl.includes('index') || fl.includes('name') || fl.includes('programme') || fl.includes('level') || fl.includes('phone') || fl.includes('student')) {
          startIndex = 1;
        }
      }

      for (let i = startIndex; i < lines.length; i++) {
        const cols = parseLine(lines[i]);
        if (cols.length < 2) continue;

        // Step 1: Find index number column
        let indexCol = -1;
        for (let c = 0; c < cols.length; c++) {
          if (isIndexNumber(cols[c])) { indexCol = c; break; }
        }
        if (indexCol === -1) continue; // skip rows with no index number

        const indexNumber = cols[indexCol];

        // Step 2: Remove index column AND any phone columns from remaining
        const remaining = cols
          .filter((val, c) => c !== indexCol)
          .filter(val => !isPhoneNotIndex(val));

        // Step 3: Find and extract level
        let levelVal = '';
        const afterLevel = remaining.filter(val => {
          if (!levelVal && isLevel(val)) { levelVal = val; return false; }
          return true;
        });

        // Step 4: Find programme — usually the longest text field remaining
        // Sort by length descending, pick the longest as programme
        let programmeVal = '';
        let nameParts: string[] = [];

        if (afterLevel.length === 0) {
          // No remaining fields after removing level
          nameParts = [];
        } else if (afterLevel.length === 1) {
          // Only one field — it's the name
          nameParts = afterLevel;
        } else {
          // Multiple fields: longest is programme, rest are name parts
          const sorted = [...afterLevel].sort((a, b) => b.length - a.length);
          programmeVal = sorted[0];
          nameParts = afterLevel.filter(v => v !== programmeVal);
        }

        const fullName = nameParts.join(', ');

        if (indexNumber && fullName) {
          data.push({
            id: indexNumber,
            name: fullName,
            programme: programmeVal,
            level: levelVal,
            email: `${indexNumber}@htu.edu.gh`
          });
        }
      }

      setParsedData(data);
    };
    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Failed to read the file.' });
    };
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

        // Refresh upload history list
        fetchUploadHistory();
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
        // Refresh history
        fetchUploadHistory();
        alert(res.message);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete upload.');
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
            Bulk import and manage eligible voters rosters
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', alignItems: 'start' }}>
        
        {/* Upload Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
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
            <div className="card animate-fade-in" style={{ maxHeight: '350px', display: 'flex', flexDirection: 'column' }}>
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
                      <th style={{ padding: '8px 12px' }}>Programme</th>
                      <th style={{ padding: '8px 12px' }}>Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 5).map((voter, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < parsedData.slice(0, 5).length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>{voter.id}</td>
                        <td style={{ padding: '8px 12px' }}>{voter.name}</td>
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
        <div className="card" style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column' }}>
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
            List of previously imported CSV files. Deleting a record will permanently erase the file log and all voters created under it.
          </p>

          <div style={{ overflowX: 'auto', flexGrow: 1, border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            {loadingHistory ? (
              <p style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading history...</p>
            ) : uploadsHistory.length === 0 ? (
              <p style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No uploads recorded yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px' }}>Filename</th>
                    <th style={{ padding: '12px' }}>Upload Date</th>
                    <th style={{ padding: '12px' }}>Success / Skipped</th>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
