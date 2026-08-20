/**
 * Frontend election status computation — mirrors backend logic.
 *
 * All dates are treated as UTC to ensure consistent status across
 * client and server regardless of timezone differences.
 *
 * Usage:
 *   import { getEffectiveStatus, isEnded, isActive } from '@/lib/electionStatus';
 *   const status = getEffectiveStatus(election);  // always correct
 *   if (isEnded(election)) { ... }
 */

export interface ElectionLike {
  status?: string;
  startDate?: string | null;
  endDate?: string | null;
  [key: string]: unknown;
}

/**
 * Parse a date string as UTC.
 * If the string has no timezone info, append 'Z' to force UTC parsing.
 */
function parseDateUTC(dateStr: string | null | undefined): number {
  if (!dateStr) return NaN;
  const s = String(dateStr).trim();
  // Already has timezone info
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    return new Date(s).getTime();
  }
  // No timezone — treat as UTC
  return new Date(s + 'Z').getTime();
}

/**
 * Compute election status from dates, matching backend logic exactly.
 * This is the single source of truth for client-side status display.
 */
export function computeStatus(election: ElectionLike): string {
  const stored = election.status || 'draft';

  if (stored === 'draft') {
    if (election.startDate && election.endDate) {
      const now = Date.now();
      const startMs = parseDateUTC(election.startDate);
      const endMs = parseDateUTC(election.endDate);
      if (isNaN(startMs) || isNaN(endMs)) return 'draft';
      if (now < startMs) return 'scheduled';
      if (now >= startMs && now <= endMs) return 'active';
    }
    return 'draft';
  }

  if (!election.startDate || !election.endDate) return stored;

  const now = Date.now();
  const startMs = parseDateUTC(election.startDate);
  const endMs = parseDateUTC(election.endDate);

  if (isNaN(startMs) || isNaN(endMs)) return stored;

  if (now < startMs) return 'scheduled';
  if (now >= startMs && now <= endMs) return 'active';
  return 'ended';
}

/**
 * Get the effective status for an election.
 * Uses the backend-provided status if it looks reasonable,
 * but falls back to client-side computation if it seems stale.
 *
 * The backend status is trusted unless:
 * - The election has start/end dates AND
 * - The computed status differs from the backend status
 *
 * In that case, the computed (time-based) status wins.
 */
export function getEffectiveStatus(election: ElectionLike): string {
  if (!election.startDate || !election.endDate) {
    return election.status || 'draft';
  }
  // Always compute from dates for reliability
  return computeStatus(election);
}

/**
 * Check if an election has ended (or is in 'completed' state).
 */
export function isEnded(election: ElectionLike): boolean {
  const s = getEffectiveStatus(election);
  return s === 'ended' || s === 'completed';
}

/**
 * Check if an election is currently active (polls open).
 */
export function isActive(election: ElectionLike): boolean {
  return getEffectiveStatus(election) === 'active';
}

/**
 * Check if an election is scheduled (not yet started).
 */
export function isScheduled(election: ElectionLike): boolean {
  return getEffectiveStatus(election) === 'scheduled';
}

/**
 * Get a human-readable label for the election status.
 */
export function getStatusLabel(election: ElectionLike): string {
  const status = getEffectiveStatus(election);
  switch (status) {
    case 'active': return 'Active';
    case 'ended': return 'Closed';
    case 'completed': return 'Closed';
    case 'scheduled': return 'Upcoming';
    case 'draft': return 'Draft';
    default: return status;
  }
}

/**
 * Get the CSS class for the status badge color.
 */
export function getStatusColor(election: ElectionLike): string {
  const status = getEffectiveStatus(election);
  switch (status) {
    case 'active': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    case 'ended':
    case 'completed': return 'bg-red-50 text-red-600 border-red-200';
    case 'scheduled': return 'bg-amber-50 text-amber-600 border-amber-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}
