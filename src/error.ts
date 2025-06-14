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
