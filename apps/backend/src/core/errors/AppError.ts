export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown, code = 'VALIDATION_ERROR') {
    super(400, code, message, details);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required', details?: unknown, code = 'AUTH_ERROR') {
    super(401, code, message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown, code = 'FORBIDDEN') {
    super(403, code, message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', details?: unknown, code = 'NOT_FOUND') {
    super(404, code, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown, code = 'CONFLICT') {
    super(409, code, message, details);
  }
}

export class BusinessRuleError extends AppError {
  constructor(message = 'Business rule violation', details?: unknown, code = 'BUSINESS_RULE_ERROR') {
    super(422, code, message, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details?: unknown, code = 'RATE_LIMIT') {
    super(429, code, message, details);
  }
}

export class DependencyError extends AppError {
  constructor(message = 'Upstream dependency unavailable', details?: unknown, code = 'DEPENDENCY_ERROR') {
    super(503, code, message, details);
  }
}
