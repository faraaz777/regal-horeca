/**
 * Soft-nav leave guard for Admin Control Hub.
 *
 * beforeunload covers reload / tab close. Next.js <Link> soft navigations and
 * router.push (e.g. Logout) need an in-app confirm — ProductForm registers a
 * blocker while unsaved edits exist.
 */

let blocker = null;

/**
 * @param {null | (() => string | null | undefined)} next
 *        Return a confirm message to block, or null/undefined to allow navigation.
 */
export function setAdminNavBlocker(next) {
  blocker = typeof next === 'function' ? next : null;
}

export function clearAdminNavBlocker() {
  blocker = null;
}

/**
 * @returns {boolean} true if navigation should proceed
 */
export function confirmAdminNavLeave() {
  if (typeof blocker !== 'function') return true;
  let message;
  try {
    message = blocker();
  } catch {
    return true;
  }
  if (!message) return true;
  if (typeof window === 'undefined') return true;
  return window.confirm(String(message));
}
