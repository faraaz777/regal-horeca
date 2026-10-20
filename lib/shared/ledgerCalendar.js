/** Stock activity dates are India calendar days, not UTC midnights. */
export const LEDGER_TIME_ZONE = 'Asia/Kolkata';

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function istTodayIso(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LEDGER_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addIsoDays(iso, delta) {
  const match = ISO_DAY.exec(String(iso || ''));
  if (!match) return '';
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + delta));
  return utc.toISOString().slice(0, 10);
}

export function inclusiveIsoDays(fromIso, toIso) {
  const days = [];
  if (!ISO_DAY.test(fromIso) || !ISO_DAY.test(toIso) || fromIso > toIso) return days;
  let cursor = fromIso;
  while (cursor <= toIso && days.length < 4000) {
    days.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return days;
}

export function normalizeLedgerDateInputs(dateFrom = '', dateTo = '') {
  let from = ISO_DAY.test(String(dateFrom || '')) ? String(dateFrom) : '';
  let to = ISO_DAY.test(String(dateTo || '')) ? String(dateTo) : '';
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  return { dateFrom: from, dateTo: to };
}

export function ledgerDayStart(iso) {
  if (!ISO_DAY.test(String(iso || ''))) return null;
  return new Date(`${iso}T00:00:00+05:30`);
}

export function ledgerDayEnd(iso) {
  if (!ISO_DAY.test(String(iso || ''))) return null;
  return new Date(`${iso}T23:59:59.999+05:30`);
}

export function formatIsoDayLabel(iso) {
  const match = ISO_DAY.exec(String(iso || ''));
  if (!match) return '';
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toLocaleDateString(
    'en-IN',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }
  );
}

export function weekdayLabel(iso) {
  const match = ISO_DAY.exec(String(iso || ''));
  if (!match) return '';
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).toLocaleDateString(
    'en-IN',
    { weekday: 'long', timeZone: 'UTC' }
  );
}

/** Monday-start week key in the ISO calendar of the date string. */
export function weekStartIso(iso) {
  const match = ISO_DAY.exec(String(iso || ''));
  if (!match) return '';
  const utc = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const day = utc.getUTCDay();
  const delta = day === 0 ? -6 : 1 - day;
  return addIsoDays(iso, delta);
}

export function monthStartIso(iso) {
  return ISO_DAY.test(String(iso || '')) ? `${iso.slice(0, 7)}-01` : '';
}
