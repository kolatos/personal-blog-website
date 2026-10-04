import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Middleware factory that validates `req.body` against a Zod schema.
 *
 * On success, `req.body` is replaced with the parsed (and coerced) value.
 * On failure, returns HTTP 400 with an ErrorResponse that includes
 * field-level error messages in the `fields` property.
 *
 * Requirements: 7.7, 2.3, 3.5, 6.7, 8.2, 8.4
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const fields = extractFieldErrors(result.error);

      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          fields,
        },
      });
      return;
    }

    // Replace req.body with the parsed/coerced value from Zod
    req.body = result.data;
    next();
  };
}

/**
 * Extracts field-level error messages from a ZodError.
 * For each invalid field, uses the first error message.
 */
function extractFieldErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const issue of error.issues) {
    // issue.path is an array of keys/indices; join with '.' for nested fields
    const fieldPath = issue.path.length > 0 ? issue.path.join('.') : '_root';
    // Keep the first error message for each field path
    if (!(fieldPath in fields)) {
      fields[fieldPath] = issue.message;
    }
  }

  return fields;
}
