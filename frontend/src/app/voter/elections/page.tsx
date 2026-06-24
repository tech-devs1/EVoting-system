'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import { Search, FolderOpen, Clock, Lock } from 'lucide-react';

interface Election {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed';
}

function CountdownTimer({ endsAt, status }: { endsAt: string; status: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [endingSoon, setEndingSoon] = useState(false);

  useEffect(() => {
    if (status === 'completed') {
      setTimeLeft('Ended');
      return;
    }

    const endTime = new Date(endsAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setTimeLeft('Ended');
        setEndingSoon(false);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${mins}m ${secs}s`);

      if (hours < 24) {
        setEndingSoon(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endsAt, status]);

  return (
    <div className={`countdown-timer ${endingSoon ? 'ending-soon' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <Clock size={14} /> {timeLeft}
    </div>
  );
}

export default function VoterElectionsPage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [filteredList, setFilteredList] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'draft' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchElections() {
      try {
        const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
        if (res.status === 'success') {
          setElections(res.data);
          setFilteredList(res.data);
        }
      } catch (err) {
        console.error('Error fetching elections:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchElections();
  }, []);

  useEffect(() => {
    let result = elections;

    if (selectedFilter !== 'all') {
      result = result.filter(el => el.status === selectedFilter);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(el => 
        el.title.toLowerCase().includes(q) || 
        el.description.toLowerCase().includes(q)
      );
    }

    setFilteredList(result);
  }, [selectedFilter, searchQuery, elections]);

  const mapStatusLabel = (status: string) => {
    if (status === 'draft') return 'upcoming';
    if (status === 'completed') return 'closed';
    return status;
  };

  const mapStatusBadgeClass = (status: string) => {
    if (status === 'active') return 'badge-success';
    if (status === 'completed') return 'badge-danger';
    if (status === 'draft') return 'badge-warning';
    return 'badge-info';
  };

  return (
    <div className="animate-page-enter">
      {/* Top Filter and Search Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div className="tabs-container" style={{ marginBottom: 0 }}>
          <button 
            className={`tab-btn ${selectedFilter === 'all' ? 'active' : ''}`} 
            onClick={() => setSelectedFilter('all')}
          >
            All Elections
          </button>
          <button 
            className={`tab-btn ${selectedFilter === 'active' ? 'active' : ''}`} 
            onClick={() => setSelectedFilter('active')}
          >
            Active
          </button>
          <button 
            className={`tab-btn ${selectedFilter === 'draft' ? 'active' : ''}`} 
            onClick={() => setSelectedFilter('draft')}
          >
            Upcoming
          </button>
          <button 
            className={`tab-btn ${selectedFilter === 'completed' ? 'active' : ''}`} 
            onClick={() => setSelectedFilter('completed')}
          >
            Closed
          </button>
        </div>
        
        <div className="form-input-container" style={{ maxWidth: '300px', width: '100%' }}>
          <Search size={18} className="form-input-icon" />
          <input 
            type="text" 
            className="form-input form-input-with-icon" 
            placeholder="Search elections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Elections Cards Grid */}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Synchronizing ballot database...</p>
      ) : filteredList.length === 0 ? (
        <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
          <FolderOpen size={48} style={{ color: 'var(--text-tertiary)' }} />
          <h3>No Elections Found</h3>
          <p>No matching election schedules fit the active queries.</p>
        </div>
      ) : (
        <div className="election-grid">
          {filteredList.map(el => {
            const statusLabel = mapStatusLabel(el.status);
            const badgeClass = mapStatusBadgeClass(el.status);

            return (
              <div className="card election-card card-hover" key={el.id}>
                <div className="election-card-header">
                  <h4 className="election-card-title">{el.title}</h4>
                  <span className={`badge ${badgeClass}`}>{statusLabel}</span>
                </div>
                <p className="election-card-desc">{el.description}</p>
                <div className="election-card-meta">
                  <CountdownTimer endsAt={el.endDate} status={el.status} />
                  {el.status === 'active' ? (
                    <Link href={`/voter/elections/${el.id}`} className="btn btn-primary btn-sm">
                      Vote Now
                    </Link>
                  ) : el.status === 'completed' ? (
                    <Link href={`/voter/verify`} className="btn btn-outline btn-sm">
                      Audit Records
                    </Link>
                  ) : (
                    <button className="btn btn-secondary btn-sm" disabled style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={12} /> Locked
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
