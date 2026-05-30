/**
 * Lightweight request validation helpers for Supabase Edge Functions.
 *
 * Uses only native TypeScript/Deno primitives — no external dependencies —
 * so it works across all functions without touching deno.lock.
 *
 * Usage:
 *   import { requireString, requireArray, ValidationError } from '../_shared/validate.ts';
 *
 *   const body = await req.json();
 *   const prompt = requireString(body.prompt, 'prompt');
 *   const messages = requireArray(body.messages, 'messages');
 */

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Assert that a value is a non-empty string within an optional max length.
 * Returns the trimmed string.
 */
export function requireString(val: unknown, field: string, maxLen = 10_000): string {
  if (typeof val !== 'string' || val.trim().length === 0) {
    throw new ValidationError(`'${field}' must be a non-empty string`);
  }
  if (val.length > maxLen) {
    throw new ValidationError(`'${field}' exceeds the maximum allowed length of ${maxLen} characters`);
  }
  return val.trim();
}

/**
 * Assert that a value is a non-empty array within an optional max item count.
 */
export function requireArray(val: unknown, field: string, maxItems = 200): unknown[] {
  if (!Array.isArray(val)) {
    throw new ValidationError(`'${field}' must be an array`);
  }
  if (val.length === 0) {
    throw new ValidationError(`'${field}' must not be empty`);
  }
  if (val.length > maxItems) {
    throw new ValidationError(`'${field}' exceeds the maximum of ${maxItems} items`);
  }
  return val;
}

/**
 * Assert that a value is a number within [min, max].
 * Returns the value or the provided default if the value is null/undefined.
 */
export function optionalNumber(
  val: unknown,
  field: string,
  min: number,
  max: number,
  defaultVal: number = min,
): number {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val !== 'number' || isNaN(val)) {
    throw new ValidationError(`'${field}' must be a number`);
  }
  if (val < min || val > max) {
    throw new ValidationError(`'${field}' must be between ${min} and ${max}`);
  }
  return val;
}

/**
 * Assert that a value is a string that belongs to an allowed set.
 */
export function requireEnum<T extends string>(val: unknown, field: string, allowed: readonly T[]): T {
  if (typeof val !== 'string' || !allowed.includes(val as T)) {
    throw new ValidationError(`'${field}' must be one of: ${allowed.join(', ')}`);
  }
  return val as T;
}

/**
 * Assert that a value is a string if present (optional field).
 */
export function optionalString(val: unknown, field: string, maxLen = 10_000): string | undefined {
  if (val === undefined || val === null) return undefined;
  return requireString(val, field, maxLen);
}
