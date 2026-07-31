import { z } from 'zod';

export const createCommitteeSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1, 'Committee name is required').max(150),
  code: z.string().min(1, 'Committee code is required').max(50),
  totalMembers: z.number().int().positive(),
  totalMonths: z.number().int().positive(),
  monthlyInstallment: z.number().positive(),
  startDate: z.string().min(1, 'Start date required'),
  rules: z.object({
    loan_percentage: z.number().optional(),
    minimum_paid_months: z.number().optional(),
    maximum_open_loans: z.number().optional(),
    lucky_draw_action: z.string().optional(),
    gift_winner_action: z.string().optional(),
    cash_alternative_enabled: z.boolean().optional(),
  }).optional(),
});

export type CreateCommitteeDTO = z.infer<typeof createCommitteeSchema>;
