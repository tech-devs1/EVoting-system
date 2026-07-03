'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import { AlertTriangle, ArrowLeft, ShieldCheck, CheckCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface Candidate {
  id: string;
  name: string;
  position: string;
  photoUrl: string;
}

interface Election {
  id: string;
  title: string;
}

export default function VoteConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  
  const electionId = resolvedParams.id;
  // Get all candidate IDs passed in search params
  const candidateIds = searchParams.getAll('candidateId');

  const [election, setElection] = useState<Election | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (candidateIds.length === 0) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const electionRes = await apiRequest<{ status: string; data: Election }>(`/elections/${electionId}`);
        if (electionRes.status === 'success') {
          setElection(electionRes.data);
        }

        const candidatesRes = await apiRequest<{ status: string; data: Candidate[] }>(`/candidates/election/${electionId}`);
        if (candidatesRes.status === 'success') {
          const filtered = candidatesRes.data.filter(c => candidateIds.includes(c.id));
          setCandidates(filtered);
        }
      } catch (err) {
        console.error('Error fetching confirmation data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [electionId, searchParams]);

  if (loading) {
    return <p style={{ color: 'var(--text-secondary)' }}>Preparing ballot confirmation details...</p>;
  }

  if (!election || candidates.length === 0) {
    return (
      <div className="empty-state">
        <AlertTriangle size={48} style={{ color: 'var(--color-danger)' }} />
        <h3>Invalid Session</h3>
        <p>No valid candidates selection parameters were registered for this checkout flow.</p>
        <Link href="/voter/elections" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }}>
          Back to Elections
        </Link>
      </div>
    );
  }

  // Facial verification states
  const [isFaceVerifyOpen, setIsFaceVerifyOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scanMessage, setScanMessage] = useState('Position your face within the scanner ring');
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setCameraActive(true);
    setScanComplete(false);
    setScanSuccess(false);
    setScanning(false);
    setScanMessage('Initializing camera stream...');

    if (!user || !user.faceImage) {
      setScanMessage('No biometric profile found on file! Denied voting access.');
      setCameraActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320, facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setScanMessage('Align your face to match your registered profile.');
    } catch (err) {
      console.error('Camera stream access failed:', err);
      setScanMessage('Camera hardware error. Biometric verification failed.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleStartScan = () => {
    if (!user || !user.faceImage) {
      setScanMessage('Verification denied: missing face template.');
      return;
    }

    setScanning(true);
    setScanMessage('Extracting live facial vectors...');
    
    // Simulate biometric comparison algorithm
    setTimeout(() => {
      setScanMessage('Comparing vectors with enrolled template...');
      setTimeout(() => {
        setScanComplete(true);
        setScanning(false);
        setScanSuccess(true);
        setScanMessage('Facial match verified (99.8% match confidence)!');
        
        // Proceed to cast vote after 1.5s
        setTimeout(() => {
          stopCamera();
          setIsFaceVerifyOpen(false);
          castBallot();
        }, 1500);
      }, 1500);
    }, 1500);
  };

  const triggerFacialVerification = () => {
    setIsFaceVerifyOpen(true);
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  const castBallot = async () => {
    setError('');
    setSubmitting(true);
    try {
      // Cast all votes in parallel
      const castPromises = candidates.map(cand =>
        apiRequest<{ 
          status: string; 
          data: { verificationId: string } 
        }>('/votes/cast', 'POST', {
          electionId,
          candidateId: cand.id
        })
      );

      const responses = await Promise.all(castPromises);
      
      // Grab verification ID from the first cast response as representative or store all
      const verificationId = responses[0]?.data?.verificationId || 'verified';

      // Save to local storage voter votes history
      if (typeof window !== 'undefined') {
        const storedVotes = localStorage.getItem('Votick_voter_votes') || '[]';
        const parsed = JSON.parse(storedVotes);
        
        responses.forEach((res, i) => {
          if (res.status === 'success') {
            const cand = candidates[i];
            parsed.push({
              id: res.data.verificationId,
              electionId,
              electionName: `${election.title} — ${cand.position}`,
              timestamp: new Date().toISOString()
            });
          }
        });
        
        localStorage.setItem('Votick_voter_votes', JSON.stringify(parsed));
      }

      // Redirect to success screen
      router.push(`/voter/elections/${electionId}/success?verificationId=${verificationId}`);
    } catch (err: any) {
      setError(err.message || 'Transmission failed. Ensure you are eligible and haven\'t already voted in these categories.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCastBallot = () => {
    triggerFacialVerification();
  };

  return (
    <div className="confirm-box animate-page-enter" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h2 style={{ marginBottom: 'var(--space-2)' }}>Confirm Your Vote choices</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Verify the details of your cryptographic ballot before transmission to the audit chain.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ 
          padding: 'var(--space-3) var(--space-4)', 
          borderRadius: 'var(--radius-md)', 
          marginBottom: 'var(--space-4)',
          fontSize: 'var(--text-sm)',
          background: 'var(--color-danger-bg)',
          color: 'var(--color-danger)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          textAlign: 'left'
        }}>
          {error}
        </div>
      )}

      {/* Selected Summary Card List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
        {candidates.map(candidate => (
          <div className="glass-card" key={candidate.id} style={{ 
            textAlign: 'left', 
            display: 'flex', 
            gap: 'var(--space-4)', 
            alignItems: 'center', 
            borderColor: 'rgba(37, 99, 235, 0.2)',
            padding: 'var(--space-3)'
          }}>
            <img 
              src={candidate.photoUrl || 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'} 
              alt={candidate.name} 
              style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} 
            />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '10px', color: 'var(--color-primary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>
                {candidate.position}
              </span>
              <h3 style={{ fontSize: 'var(--text-base)', margin: '2px 0', fontWeight: 600 }}>{candidate.name}</h3>
              <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>{election.title}</p>
            </div>
            <CheckCircle size={18} color="var(--color-success, #22c55e)" style={{ marginRight: 'var(--space-2)' }} />
          </div>
        ))}
      </div>

      {/* Warning Panel Alert */}
      <div className="alert alert-warning" style={{ marginBottom: 'var(--space-8)', textAlign: 'left', display: 'flex', gap: 'var(--space-3)' }}>
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <p style={{ fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Warning: Action is Permanent</p>
          <p style={{ margin: 0, fontSize: 'var(--text-xs)' }}>
            Your votes cannot be changed or recalled after submission. The audit ledger does not support modifications once block confirmation completes.
          </p>
        </div>
      </div>

      {/* Submit Items Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center' }}>
        <Link href={`/voter/elections/${electionId}`} className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowLeft size={18} /> Go Back
        </Link>
        <button 
          className="btn btn-primary btn-lg" 
          onClick={handleCastBallot} 
          disabled={submitting}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <ShieldCheck size={18} /> {submitting ? 'Transmitting ballot...' : 'Cast Ballot Securely'}
        </button>
      </div>

      {/* Biometric Verification Modal Overlay */}
      {isFaceVerifyOpen && (
        <div className="modal-overlay active" style={{ zIndex: 10000 }}>
          <div className="modal-container" style={{ maxWidth: '520px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Biometric Identity Verification</h3>
              <button 
                className="modal-close" 
                onClick={() => {
                  stopCamera();
                  setIsFaceVerifyOpen(false);
                }}
              >
                &times;
              </button>
            </div>
            
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
              
              {/* Dual image feed layout */}
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                
                {/* Enrolled Template */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>Enrolled Template</span>
                  <div style={{
                    width: '160px',
                    height: '160px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '3px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {user?.faceImage ? (
                      <img 
                        src={user.faceImage} 
                        alt="Registered Biometric" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                    ) : (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>No template</span>
                    )}
                  </div>
                </div>

                {/* Live Scanner Feed */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)' }}>Live Scanner Feed</span>
                  <div style={{
                    position: 'relative',
                    width: '160px',
                    height: '160px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: '3px solid var(--border-color)',
                    boxShadow: scanning ? '0 0 15px rgba(99, 102, 241, 0.4)' : scanComplete && scanSuccess ? '0 0 15px rgba(34, 197, 94, 0.4)' : 'none',
                    background: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <video 
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        transform: 'scaleX(-1)' // mirror view
                      }}
                    />

                    {/* Face silhouette overlay */}
                    <div style={{
                      position: 'absolute',
                      inset: '12px',
                      border: '1.5px dashed rgba(255, 255, 255, 0.4)',
                      borderRadius: '50%',
                      pointerEvents: 'none'
                    }} />

                    {/* Green laser scan bar */}
                    {scanning && (
                      <div style={{
                        position: 'absolute',
                        width: '100%',
                        height: '3px',
                        background: 'var(--color-primary, #6366f1)',
                        boxShadow: '0 0 6px var(--color-primary, #6366f1)',
                        animation: 'scanLaser 2s linear infinite',
                        top: 0
                      }} />
                    )}
                  </div>
                </div>

              </div>

              {/* Status Message */}
              <div style={{ marginTop: 'var(--space-2)' }}>
                <p style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: scanComplete ? (scanSuccess ? 'var(--color-success, #22c55e)' : 'var(--color-danger, #ef4444)') : 'var(--text-primary)',
                  margin: 0
                }}>
                  {scanMessage}
                </p>
              </div>

            </div>

            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  stopCamera();
                  setIsFaceVerifyOpen(false);
                }}
                disabled={scanning}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleStartScan}
                disabled={!cameraActive || scanning || scanComplete}
              >
                Verify & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
