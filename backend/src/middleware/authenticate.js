const jwt = require('jsonwebtoken');
const config = require('../config');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing' });
  }

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
