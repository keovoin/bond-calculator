/**
 * Shared request helpers for Vercel serverless functions.
 */

function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  res.status(405).json({ error: `Method not allowed. Allowed: ${allowed.join(', ')}.` });
}

function readBody(req) {
  if (req.body === undefined || req.body === null) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body;
}

function handleError(res, err) {
  console.error(err);
  const msg = (err && err.message) || 'Internal error';
  res.status(500).json({ error: msg });
}

module.exports = { methodNotAllowed, readBody, handleError };
