/**
 * Group sales requests by human-readable date labels for history UI.
 */

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function requestDate(r) {
  const raw = r.submittedAt || r.createdAt;
  return raw ? new Date(raw) : new Date();
}

function dayKey(d) {
  return startOfDay(d).toISOString().slice(0, 10);
}

function formatSectionLabel(d) {
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((today - target) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) {
    return target.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }
  return target.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * @param {Array} requests newest-first
 * @returns {Array<{ label: string, sortKey: string, items: Array }>}
 */
export function groupRequestsByDate(requests) {
  const map = new Map();

  for (const r of requests) {
    const d = requestDate(r);
    const key = dayKey(d);
    if (!map.has(key)) {
      map.set(key, { label: formatSectionLabel(d), sortKey: key, items: [] });
    }
    map.get(key).items.push(r);
  }

  return [...map.values()].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

export function formatWaiting(date) {
  if (!date) return '';
  const ms = Date.now() - new Date(date).getTime();
  if (ms < 0) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m waiting`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.floor(hours / 24);
  return `${days}d waiting`;
}

export function formatRequestDateTime(r) {
  const d = requestDate(r);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
