'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, FileSpreadsheet, Download, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } }
};

interface PerformanceRow {
  name: string;
  total: number;
  cast: number;
  rate: string;
  status: string;
}

export default function AdminAnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await apiRequest<{ status: string; data: any }>('/admin/analytics');
        if (res.status === 'success') {
          setAnalyticsData(res.data);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const handleExport = async (format: string) => {
    try {
      const res = await apiRequest<{ status: string; message: string; downloadUrl?: string }>(`/admin/export/${format}`);
      if (res.status === 'success') {
        alert(res.message);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to generate export.');
    }
  };

  if (loading || !analyticsData) {
    return (
      <div className="animate-page-enter">
        <p style={{ color: 'var(--text-secondary)' }}>Loading analytics...</p>
      </div>
    );
  }

  const { departmentParticipation, peakVotingTimes, performanceSummary } = analyticsData;

  return (
    <div className="animate-page-enter">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <Link href="/admin/dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
            <ArrowLeft size={14} /> Return to Dashboard
          </Link>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-1)' }}>Detailed Election Analytics</h2>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>Historical metrics, trends and download logs</span>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('pdf')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileText size={14} /> Export PDF
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('excel')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileSpreadsheet size={14} /> Export Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => handleExport('csv')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="admin-grid-charts" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 'var(--space-6)' }}>
        <div className="card chart-card">
          <h3 className="chart-title" style={{ marginBottom: 'var(--space-4)' }}>Participation Rate by Department</h3>
          <div className="chart-body" style={{ height: '280px', position: 'relative' }}>
            <Bar data={departmentParticipation} options={chartOptions} />
          </div>
        </div>

        <div className="card chart-card">
          <h3 className="chart-title" style={{ marginBottom: 'var(--space-4)' }}>Peak Voting Times Stream</h3>
          <div className="chart-body" style={{ height: '280px', position: 'relative' }}>
            <Line data={peakVotingTimes} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* Summary Statistics Table */}
      <div className="card">
        <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-4)' }}>Election Performance Summary</h3>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Election Name</th>
                <th>Total Voters</th>
                <th>Votes Cast</th>
                <th>Turnout Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {performanceSummary.map((row: PerformanceRow) => (
                <tr key={row.name}>
                  <td style={{ fontWeight: 'var(--weight-medium)', fontSize: 'var(--text-sm)' }}>{row.name}</td>
                  <td>{row.total.toLocaleString()}</td>
                  <td>{row.cast > 0 ? row.cast.toLocaleString() : '—'}</td>
                  <td style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>{row.rate}</td>
                  <td>
                    <span className={`badge ${row.status === 'active' ? 'badge-success' : row.status === 'completed' ? 'badge-info' : 'badge-warning'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

