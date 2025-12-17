/**
 * Authentication Utilities
 * 
 * Handles JWT token generation and verification for admin authentication.
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token expires in 7 days

/**
 * Generates a JWT token for admin user
 * 
 * @param {string} email - Admin email
 * @returns {string} JWT token
 */
export function generateToken(email) {
  const token = jwt.sign(
    { email, role: 'admin' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
  // Only log in development
  if (process.env.NODE_ENV === 'development') {
    console.log('generateToken:', { 
      email, 
      secretLength: JWT_SECRET?.length,
      usingDefault: JWT_SECRET === 'your-secret-key-change-in-production',
      tokenLength: token?.length 
    });
  }
  return token;
}

/**
 * Verifies a JWT token
 * 
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded token payload or null if invalid
 */
export function verifyToken(token) {
  try {
    if (!token) {
      if (process.env.NODE_ENV === 'development') {
        console.log('verifyToken: No token provided');
      }
      return null;
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    // Only log in development - don't expose auth errors in production
    if (process.env.NODE_ENV === 'development') {
      console.log('verifyToken error:', error.message, { 
        tokenLength: token?.length,
        usingDefaultSecret: JWT_SECRET === 'your-secret-key-change-in-production'
      });
    }
    return null;
  }
}

/**
 * Extracts token from Authorization header
 * 
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
export function extractTokenFromHeader(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Middleware function to verify admin authentication
 * Use this in API routes to protect admin endpoints
 * 
 * @param {Request} req - Next.js request object
 * @returns {object|null} Decoded token or null if not authenticated
 */
export function verifyAdminAuth(req) {
  const authHeader = req.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader);
  
  if (!token) {
    return null;
  }
  
  return verifyToken(token);
}

