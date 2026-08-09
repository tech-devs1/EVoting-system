'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminElectionsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
      Redirecting to Organization Election Hub...
    </div>
  );
}
