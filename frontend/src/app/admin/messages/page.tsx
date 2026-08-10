'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { Mail, ArrowRight, Layers, Send } from 'lucide-react';

interface Election {
  id: string;
  title: string;
  voterCount?: number;
  status?: string;
}

export default function GlobalMessagesPage() {
  const router = useRouter();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchElections() {
      try {
        setLoading(true);
        const res = await apiRequest<{ status: string; data: Election[] }>('/elections');
        if (res.status === 'success' && Array.isArray(res.data)) {
          setElections(res.data);
          // If elections exist, default to first election's message hub
          if (res.data.length > 0) {
            router.replace(`/admin/elections/${res.data[0].id}/messages`);
          }
        }
      } catch (err) {
        console.error('Error loading elections for messaging hub:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchElections();
  }, [router]);

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Mail size={28} style={{ color: '#2563eb' }} /> Broadcast Communications Hub
        </h2>
        <p style={{ color: '#64748B', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
          Select an active election workspace below to compose and dispatch Gmail-style Email & SMS broadcasts:
        </p>
      </div>

      {loading ? (
        <p style={{ color: '#64748B', textAlign: 'center', padding: '2rem' }}>Loading active election workspaces...</p>
      ) : elections.length === 0 ? (
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <Layers size={40} style={{ color: '#94A3B8', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>No Active Elections Found</h3>
          <p style={{ color: '#64748B', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Create an election first to upload a voter CSV list and dispatch broadcast messages.
          </p>
          <Link href="/admin/dashboard" className="btn btn-primary" style={{ fontWeight: 700 }}>
            Go to Election Command Center
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {elections.map((el) => (
            <Link
              key={el.id}
              href={`/admin/elections/${el.id}/messages`}
              className="card"
              style={{
                padding: '1.25rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                textDecoration: 'none',
                color: '#0F172A',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                transition: 'all 0.2s ease'
              }}
            >
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#0F172A' }}>{el.title}</h4>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: 0 }}>
                  Roster Size: {el.voterCount || 0} voters • Status: <strong style={{ textTransform: 'uppercase', color: '#2563eb' }}>{el.status || 'Active'}</strong>
                </p>
              </div>

              <span className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 700, color: '#2563eb' }}>
                Open Broadcast Composer <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
