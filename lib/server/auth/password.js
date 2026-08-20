import 'server-only';

import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const SALT_ROUNDS = 10;
export const MIN_PASSWORD_LENGTH = 8;

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), SALT_ROUNDS);
}

export async function verifyPassword(plain, passwordHash) {
  if (!plain || !passwordHash) return false;
  return bcrypt.compare(String(plain), passwordHash);
}

export function assertPasswordStrength(plain) {
  const value = String(plain || '');
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (value.length > 128) {
    throw new Error('Password is too long');
  }
}

/**
 * One-time admin temp password. Shown once in the API response, never stored plain.
 */
export function generateTempPassword() {
  return randomBytes(9).toString('base64url');
}
