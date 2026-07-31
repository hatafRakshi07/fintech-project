import { z } from 'zod';

export const createExpenseSchema = z.object({
  organizationId: z.string().uuid(),
  categoryId: z.string().uuid(),
  expenseDate: z.string().min(1, 'Expense date is required'),
  amount: z.number().positive('Expense amount must be positive'),
  paymentMode: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ADJUSTMENT']).default('CASH'),
  spentById: z.string().uuid().optional(),
  receiptUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

export type CreateExpenseDTO = z.infer<typeof createExpenseSchema>;
