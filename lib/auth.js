/**
 * Stateless JWT auth for Vercel serverless functions.
 * We store a signed JWT in an httpOnly cookie. No session store needed.
 */

const jwt = require('jsonwebtoken');
const { parse, serialize } = require('cookie');

const COOKIE_NAME = 'bc_token';
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error('JWT_SECRET env var must be set (at least 16 characters).');
  }
  return s;
}

function signSession(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: MAX_AGE_SECONDS });
}

function readSession(req) {
  const header = req.headers.cookie || '';
  const cookies = parse(header);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  const cookie = serialize(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  const cookie = serialize(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  res.setHeader('Set-Cookie', cookie);
}

function requireAdmin(req, res) {
  const session = readSession(req);
  if (!session || !session.adminId) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  return session;
}

module.exports = {
  signSession,
  readSession,
  setSessionCookie,
  clearSessionCookie,
  requireAdmin,
};
