/**
 * File: src/error.ts
 *
 * Error types for router and HTTP error handling.
 *
 * Exports RouterError and HttpError for consistent error management across the framework.
 */

export class RouterError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class HttpError extends Error {
  status: number;
  constructor(message?: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.status = status || 500;
  }
}
