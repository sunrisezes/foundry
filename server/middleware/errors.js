export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body contains invalid JSON.' });
  }
  if (error.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(error.errors).map((entry) => entry.message).join(' ') });
  }
  if (error.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid identifier.' });
  }
  if (error.code === 11000) {
    return res.status(409).json({ message: 'An account already uses that email or student ID.' });
  }
  if (error.name === 'MulterError') {
    return res.status(400).json({ message: error.code === 'LIMIT_FILE_SIZE' ? 'Image must be 8 MB or smaller.' : error.message });
  }
  console.error(error);
  return res.status(error.status || 500).json({ message: error.status ? error.message : 'Something went wrong. Please try again.' });
}
