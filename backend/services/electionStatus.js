/**
 * Canonical election status computation.
 * 
 * This is the SINGLE source of truth for determining election status
 * based on current time vs. start/end dates. Every backend endpoint
 * and the server scheduler must use this function — never duplicate
 * the logic inline.
 *
 * Rules:
 *   - 'draft' elections stay 'draft' unless they have dates and the
 *     current time falls within the window, in which case they
 *     transition automatically.
 *   - Non-draft elections always compute status from dates.
 *   - If dates are missing or unparseable, fall back to the stored status.
 */
function computeElectionStatus(election) {
  if (!election) return 'draft';

  const stored = election.status || 'draft';

  // Draft elections with dates set: auto-transition based on schedule
  if (stored === 'draft') {
    if (election.startDate && election.endDate) {
      const now = Date.now();
      const startMs = safeTime(election.startDate);
      const endMs = safeTime(election.endDate);
      if (isNaN(startMs) || isNaN(endMs)) return 'draft';
      if (now < startMs) return 'scheduled';
      if (now >= startMs && now <= endMs) return 'active';
    }
    return 'draft';
  }

  // Non-draft: always compute from dates
  if (!election.startDate || !election.endDate) return stored;

  const now = Date.now();
  const startMs = safeTime(election.startDate);
  const endMs = safeTime(election.endDate);

  // If dates are unparseable, preserve stored status
  if (isNaN(startMs) || isNaN(endMs)) return stored;

  if (now < startMs) return 'scheduled';
  if (now >= startMs && now <= endMs) return 'active';
  return 'ended';
}

/**
 * Safely parse a date string to a timestamp.
 * Returns NaN if the string cannot be parsed.
 */
function safeTime(dateStr) {
  if (!dateStr) return NaN;
  const ms = new Date(dateStr).getTime();
  return ms;
}

/**
 * Return true if the election is currently in an ended/completed state.
 */
function isElectionEnded(election) {
  const status = computeElectionStatus(election);
  return status === 'ended' || status === 'completed';
}

/**
 * Return true if the election is currently active (polls open).
 */
function isElectionActive(election) {
  return computeElectionStatus(election) === 'active';
}

/**
 * Apply computed status to an election object and optionally persist
 * the change to the database if it differs from the stored value.
 * Returns the computed status string.
 */
async function applyComputedStatus(election, opts = {}) {
  const item = election.toJSON ? election.toJSON() : election;
  const computed = computeElectionStatus(item);

  if (item.status !== 'draft' && item.status !== computed) {
    if (opts.persist !== false && election.update) {
      await election.update({ status: computed });
    }
  }

  return computed;
}

module.exports = {
  computeElectionStatus,
  isElectionEnded,
  isElectionActive,
  applyComputedStatus,
};
