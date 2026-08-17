import logger from '../logger/logger.js';
import ApiError from './apiError.js';

/**
   * Express error handler middleware
   */
export const errorHandler = (err, req, res, next) => {
  let { statusCode, message, errors } = err;

  // Set default code and message if not standard ApiError
  if (!(err instanceof ApiError)) {
    statusCode = err.statusCode || 500;
    message = err.message || 'Something went wrong on the server';
    errors = err.errors || [];
  }

  // Format response details
  const response = {
    success: false,
    message,
    errors,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  };

  // Log error using core Logger
  logger.error(`${req.method} ${req.url} - Error: ${message}`, {
    statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    errors,
    stack: err.stack
  });

  return res.status(statusCode).json(response);
};

/**
 * Catches async errors in routes (replaces standard try-catch boilerplate)
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
