import { z } from 'zod';
import { insertLogSchema, insertCaseSchema, logs, cases } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs',
      input: z.object({
        userId: z.string().optional(),
        type: z.string().optional(),
        limit: z.coerce.number().optional().default(50),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof logs.$inferSelect>()),
      },
    },
    create: { // Mostly for internal use or testing
      method: 'POST' as const,
      path: '/api/logs',
      input: insertLogSchema,
      responses: {
        201: z.custom<typeof logs.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  cases: {
    list: {
      method: 'GET' as const,
      path: '/api/cases',
      input: z.object({
        targetId: z.string().optional(),
        moderatorId: z.string().optional(),
        type: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof cases.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/cases/:id',
      responses: {
        200: z.custom<typeof cases.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: { // Mostly for internal use or testing
      method: 'POST' as const,
      path: '/api/cases',
      input: insertCaseSchema,
      responses: {
        201: z.custom<typeof cases.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  stats: {
    get: {
      method: 'GET' as const,
      path: '/api/stats',
      responses: {
        200: z.object({
          totalLogs: z.number(),
          totalCases: z.number(),
          recentActivity: z.array(z.custom<typeof logs.$inferSelect>()),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
