import { z } from 'zod';

export const createSettlementSchema = z.object({
  organizationId: z.string().uuid(),
  committeeId: z.string().uuid(),
  tokenId: z.string().uuid(),
  customerId: z.string().uuid(),
  deductions: z.number().nonnegative().default(0),
  bonusAmount: z.number().nonnegative().default(0),
  notes: z.string().optional(),
});

export type CreateSettlementDTO = z.infer<typeof createSettlementSchema>;
