export class DomainError extends Error {
  constructor(
    public code: string,
    public status: number,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export const notFound = (what: string) => new DomainError('NOT_FOUND', 404, `${what} not found`);
export const forbidden = (msg = 'Not allowed') => new DomainError('FORBIDDEN', 403, msg);
export const badRequest = (code: string, msg?: string) => new DomainError(code, 400, msg);
export const conflict = (code: string, msg?: string) => new DomainError(code, 409, msg);
