import { mutate } from 'swr';
import { adminJson } from '@/lib/client/adminFetch';

export const SALES_SESSION_KEY = '/api/sales/session';

/** Drop cached workspace so the next read refetches from the server. */
export function invalidateSalesSession() {
  return mutate(SALES_SESSION_KEY);
}

/** Fetch latest workspace and write it into the SWR cache (use before navigating to sales floor). */
export async function primeSalesSessionCache() {
  const data = await adminJson(SALES_SESSION_KEY);
  await mutate(SALES_SESSION_KEY, data, { revalidate: false });
  return data;
}
