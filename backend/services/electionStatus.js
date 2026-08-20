/**
 * Canonical election status computation — single source of truth.
 *
 * Dates stored in the database come in two forms:
 *   1. ISO 8601 strings like "2026-08-20T11:20:00" (from datetime-local inputs)
 *   2. Locale strings like "8/20/2026, 11:20:00 AM" (from Date.toLocaleString)
 *
 * Both lack timezone info. We normalize them to ISO format and parse as UTC
 * to ensure consistent status computation across servers in different timezones.
 */
function computeElectionStatus(election) {
  if (!election) return 'draft';

  const stored = election.status || 'draft';

  // Draft elections with dates: auto-transition based on schedule
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

  // Non-draft: always compute from dates
  if (!election.startDate || !election.endDate) return stored;

  const now = Date.now();
  const startMs = parseDateUTC(election.startDate);
  const endMs = parseDateUTC(election.endDate);

  // If dates are unparseable, preserve stored status
  if (isNaN(startMs) || isNaN(endMs)) return stored;

  if (now < startMs) return 'scheduled';
  if (now >= startMs && now <= endMs) return 'active';
  return 'ended';
}

/**
 * Parse a date string as UTC.
 *
 * Strategy:
 * 1. If it's already a valid ISO string with timezone info (ends with Z or +/-HH:MM),
 *    parse it directly.
 * 2. If it's an ISO-like string without timezone (e.g. "2026-08-20T11:20:00"),
 *    append Z to force UTC.
 * 3. If it's a locale-format string (e.g. "8/20/2026, 11:20:00 AM"),
 *    try Date.parse() first (V8 handles this well in most cases),
 *    then fall back to manual parsing.
 * 4. For locale strings, we use Date.parse() which in V8 parses them in the
 *    local timezone. To get UTC, we adjust by the timezone offset.
 */
function parseDateUTC(dateStr) {
  if (!dateStr) return NaN;
  const s = String(dateStr).trim();

  // Already has timezone info — parse as-is
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s) || /[+-]\d{4}$/.test(s)) {
    return new Date(s).getTime();
  }

  // ISO format without timezone (e.g. "2026-08-20T11:20:00") — append Z
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    return new Date(s + 'Z').getTime();
  }

  // Locale format (e.g. "8/20/2026, 11:20:00 AM")
  // Date.parse() will parse it in the local timezone, then we adjust
  const localMs = Date.parse(s);
  if (isNaN(localMs)) return NaN;

  // Get the timezone offset at that time (in ms)
  const d = new Date(localMs);
  const offsetMs = d.getTime() - d.getTimezoneOffset() * 60 * 1000;

  // Return as if the parsed time was UTC
  return localMs - (d.getTimezoneOffset() * 60 * 1000);
}

function isElectionEnded(election) {
  const status = computeElectionStatus(election);
  return status === 'ended' || status === 'completed';
}

function isElectionActive(election) {
  return computeElectionStatus(election) === 'active';
}

module.exports = {
  computeElectionStatus,
  parseDateUTC,
  isElectionEnded,
  isElectionActive,
};
