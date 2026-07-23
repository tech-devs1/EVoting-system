'use client';

import React, { useState, useRef } from 'react';
import { apiRequest } from '@/lib/api';
import { UploadCloud, FileType, CheckCircle, AlertTriangle, Users } from 'lucide-react';

export default function AdminVotersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        // Simple CSV parser for "Name,ID,Email"
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        const data = [];
        
        // Skip header if it exists (assuming first row might be header if it contains 'name' or 'id')
        let startIndex = 0;
        if (lines.length > 0 && lines[0].toLowerCase().includes('name')) {
          startIndex = 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
          // split correctly keeping commas inside quotes isn't handled by simple split, but usually for these fields simple split works. 
          // For a robust one, let's just do simple split assuming names don't have commas.
          const columns = lines[i].split(',').map(col => col.trim());
          if (columns.length >= 3) {
            data.push({
              name: columns[0],
              id: columns[1],
              email: columns[2]
            });
          }
        }
        
        setParsedData(data);
        setMessage(null);
      }
    };
    reader.onerror = () => {
      setMessage({ type: 'error', text: 'Failed to read the file.' });
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      setMessage({ type: 'error', text: 'No valid data found to upload.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await apiRequest<{ status: string; message: string; data: { added: number; skipped: number } }>('/admin/voters/bulk', 'POST', parsedData);
      
      if (res.status === 'success') {
        setMessage({ type: 'success', text: res.message });
        setFile(null);
        setParsedData([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'An error occurred during upload.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-page-enter">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, margin: 0 }}>Voter Database</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0 0', fontSize: 'var(--text-sm)' }}>
            Bulk import eligible voters from a CSV file
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={20} className="text-primary" />
          Upload Voter Roster
        </h3>
        
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
          Please upload a CSV file containing the voter data. The file must contain the following columns in order (without headers or with a header row containing 'Name'): <strong>Name, ID, Email</strong>.
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
              Detected <strong>{parsedData.length}</strong> valid records ready for import.
            </p>
          </div>
        )}

        {message && (
          <div style={{ 
            padding: 'var(--space-4)', 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 'var(--space-6)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: message.type === 'success' ? '#10B981' : '#EF4444',
            border: `1px solid ${message.type === 'success' ? '#10B98144' : '#EF444444'}`
          }}>
            {message.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            <span>{message.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)' }}>
          <button 
            className="btn btn-outline" 
            onClick={() => {
              setFile(null);
              setParsedData([]);
              setMessage(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            disabled={loading || !file}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleUpload}
            disabled={loading || parsedData.length === 0}
          >
            {loading ? 'Processing...' : 'Upload Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
