import { z } from 'zod';

export const createLoanSchema = z.object({
  organizationId: z.string().uuid(),
  committeeId: z.string().uuid(),
  customerId: z.string().uuid(),
  tokenId: z.string().uuid(),
  principalAmount: z.number().positive('Principal amount must be positive'),
  interestRatePct: z.number().nonnegative().default(0),
  tenureMonths: z.number().int().positive().default(12),
  disbursalDate: z.string().min(1, 'Disbursal date required'),
  notes: z.string().optional(),
});

export type CreateLoanDTO = z.infer<typeof createLoanSchema>;
