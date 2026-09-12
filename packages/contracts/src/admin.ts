import { z } from './zod';

/** Version 1 browser-safe read resources. This is not a database table API. */
export const ADMIN_RESOURCES = [
  'dashboard', 'users', 'user-accounts', 'data-cards', 'data-card-updates',
  'tags', 'tag-aliases', 'badges', 'redemption-codes', 'messages', 'user-messages',
  'report-cases', 'report-appeals', 'crowd-review', 'inspectors', 'ratings',
  'rating-events', 'risk-audits', 'generations', 'pvp-rooms', 'large-objects',
  'analytics', 'ai-availability',
] as const;
export const AdminResourceSchema = z.enum(ADMIN_RESOURCES);
export type AdminResource = z.infer<typeof AdminResourceSchema>;

export const AdminQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(4096).optional(),
  id: z.string().min(1).max(512).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  status: z.string().min(1).max(40).optional(),
  visibility: z.preprocess((value) => typeof value === 'string' && /^-?[01]$/.test(value) ? Number(value) : value,
    z.union([z.literal(-1), z.literal(0), z.literal(1)])).optional(),
  userId: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();
export type AdminQuery = z.infer<typeof AdminQuerySchema>;
export type AdminValue = string | number | boolean | null;
/** Every producer explicitly allowlists fields; arbitrary database rows must never be returned. */
export type AdminRecord = Record<string, AdminValue>;
export type AdminReadResponse = {
  items: AdminRecord[];
  nextCursor: string | null;
};
