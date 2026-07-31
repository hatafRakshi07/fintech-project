import { z } from 'zod';

export const createInstallmentSchema = z.object({
  organizationId: z.string().uuid(),
  committeeMonthId: z.string().uuid(),
  tokenId: z.string().uuid(),
  receiptNumber: z.string().min(1, 'Receipt number required'),
  expectedAmount: z.number().nonnegative(),
  paidAmount: z.number().positive('Paid amount must be positive'),
  paymentDate: z.string().min(1, 'Payment date required'),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ADJUSTMENT']).default('CASH'),
  collectorId: z.string().uuid().optional(),
  idempotencyKey: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateInstallmentDTO = z.infer<typeof createInstallmentSchema>;
