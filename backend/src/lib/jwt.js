const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_COOKIE_NAME = 'session';
const SESSION_TTL = '7d';
const SESSION_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function signSessionToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: SESSION_TTL });
}

function verifySessionToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  return payload.sub;
}

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME);
}

module.exports = {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  setSessionCookie,
  clearSessionCookie,
};
