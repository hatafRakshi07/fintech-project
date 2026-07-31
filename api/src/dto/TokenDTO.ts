import { z } from 'zod';

export const createTokenSchema = z.object({
  organizationId: z.string().uuid(),
  committeeId: z.string().uuid(),
  customerId: z.string().uuid(),
  rawTokenNumber: z.string().min(1, 'Token number is required'),
});

export const updateTokenStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'OUT', 'TRANSFERRED', 'CANCELLED', 'SETTLED']),
  reason: z.string().optional(),
});

export type CreateTokenDTO = z.infer<typeof createTokenSchema>;
export type UpdateTokenStatusDTO = z.infer<typeof updateTokenStatusSchema>;
