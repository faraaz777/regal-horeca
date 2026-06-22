import { SignJWT, jwtVerify } from 'jose';

const ACCESS_TTL = '15m';

function getAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET (or JWT_SECRET) is not set');
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken({ userId, role, tokenVersion, email, name }) {
  return new SignJWT({
    role,
    tokenVersion,
    email: email || '',
    name: name || '',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(getAccessSecret());
}

/** Fast verify — no DB. Safe for middleware and API guards. */
export async function verifyAccessToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getAccessSecret());
    return payload;
  } catch {
    return null;
  }
}

export function sessionFromPayload(payload) {
  if (!payload?.sub) return null;
  return {
    userId: payload.sub,
    role: payload.role,
    tokenVersion: payload.tokenVersion ?? 0,
    email: payload.email || '',
    name: payload.name || '',
  };
}
