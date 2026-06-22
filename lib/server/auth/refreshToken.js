import 'server-only';

import { createHash, randomBytes } from 'crypto';
import RefreshToken from '@/lib/server/models/RefreshToken';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/shared/authCookies';

const REFRESH_DAYS = 30;

export { ACCESS_COOKIE, REFRESH_COOKIE };

export function getCookieOptions(maxAgeSeconds, path = '/') {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path,
    maxAge: maxAgeSeconds,
  };
}

export function generateRefreshToken() {
  return randomBytes(40).toString('hex');
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export async function storeRefreshToken({ userId, token, userAgent = '' }) {
  const expiresAt = new Date(Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000);
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    revoked: false,
    userAgent: userAgent || '',
  });
}

export async function revokeAllRefreshTokens(userId) {
  await RefreshToken.updateMany({ userId, revoked: false }, { revoked: true });
}

export async function revokeRefreshTokenByHash(tokenHash) {
  await RefreshToken.updateOne({ tokenHash, revoked: false }, { revoked: true });
}

/**
 * Rotate refresh token. Detects reuse and revokes all sessions for user.
 */
export async function rotateRefreshToken(oldToken, { userAgent = '' } = {}) {
  const oldHash = hashToken(oldToken);
  const record = await RefreshToken.findOne({ tokenHash: oldHash, revoked: false }).lean();

  if (!record || record.expiresAt < new Date()) {
    return null;
  }

  if (record.usedAt) {
    await revokeAllRefreshTokens(record.userId);
    return null;
  }

  await RefreshToken.updateOne({ _id: record._id }, { usedAt: new Date(), revoked: true });

  const newToken = generateRefreshToken();
  await storeRefreshToken({
    userId: record.userId,
    token: newToken,
    userAgent,
  });

  return { newToken, userId: record.userId };
}

export async function findValidRefreshRecord(token) {
  const tokenHash = hashToken(token);
  return RefreshToken.findOne({ tokenHash, revoked: false }).lean();
}
