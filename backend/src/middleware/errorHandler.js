function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'ValidationError' || err.type === 'validation') {
    return res.status(400).json({ error: err.message });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with this value already exists' });
  }

  const status = err.status || err.statusCode || 500;
  const message = status < 500 ? err.message : 'Something went wrong';

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
