/**
 * Shared Type Definitions for HTU-Elect Electronic Voting System
 */

export interface Voter {
  id: string;
  studentId: string;
  name: string;
  email: string;
  phone?: string;
  programme?: string;
  level?: string;
  role: 'voter' | 'admin';
  isRegistered: boolean;
  faceImage?: string;
  hasVoted?: boolean;
  verificationCode?: string;
}

export interface Candidate {
  id: string;
  name: string;
  position: string;
  electionId: string;
  manifesto?: string;
  manifestoUrl?: string;
  photoUrl?: string;
  votes?: number;
  noVotes?: number;
  isIndependent?: boolean;
  ballotNumber?: string | number;
  createdAt?: number;
  selectedId?: string;
  choice?: 'yes' | 'no';
}

export interface Election {
  id: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: 'draft' | 'scheduled' | 'active' | 'ended' | 'completed';
  showResults?: boolean;
  allowMultiplePositions?: boolean;
  createdAt?: number;
}

export interface AuditLog {
  id: string;
  timestamp: number;
  electionId: string;
  voterHash?: string;
  candidateName?: string;
  position?: string;
  verificationCode?: string;
}

export interface DashboardStats {
  totalElections: number;
  totalVoters: number;
  totalVotesCast: number;
  activeAlerts: number;
  totalStudents: number;
  uniqueVotersCount: number;
  activeElectionsCount: number;
  completedElectionsCount: number;
  topCandidates: Array<{ name: string; votes: number }>;
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
}
