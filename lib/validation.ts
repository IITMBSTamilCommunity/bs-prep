import z from "zod";

// Email validation
const emailSchema = z.string().email().toLowerCase().max(255);

// Phone validation (basic international format)
const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/)
  .max(20);

// Name validation (supports common real-world name formats, including numeric suffixes)
const nameSchema = z.string().min(2).max(100).regex(/^[a-zA-Z0-9\s'.-]+$/);

// Course ID validation (slug format)
const courseIdSchema = z.string().regex(/^[a-z0-9-]+$/);

// Sanitize string input to prevent XSS
export function sanitizeString(input: unknown): string {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }

  return input
    .trim()
    .slice(0, 1000) // Max length
    .replace(/<script[^>]*>.*?<\/script>/gi, "") // Remove scripts
    .replace(/on\w+\s*=/gi, "") // Remove event handlers
    .replace(/<[^>]+>/g, ""); // Remove HTML tags
}

// Validate payment form data
export function validatePaymentForm(data: unknown) {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid form data");
  }

  const form = data as Record<string, unknown>;
  const rawPhone = sanitizeString(form.phone);
  // Accept common input formats like "+91 63825 12015" or "63825-12015".
  const normalizedPhone = rawPhone.replace(/[\s()-]/g, "");

  return {
    name: nameSchema.parse(sanitizeString(form.name)),
    email: emailSchema.parse(sanitizeString(form.email)),
    phone: phoneSchema.parse(normalizedPhone),
  };
}

// Validate course ID
export function validateCourseId(courseId: unknown): string {
  return courseIdSchema.parse(courseId);
}

// Validate amount (in paise)
export function validateAmount(amount: unknown): number {
  const num = z.number().int().positive().max(1000000).parse(amount);
  return num;
}

// Secure comparison for signatures
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
