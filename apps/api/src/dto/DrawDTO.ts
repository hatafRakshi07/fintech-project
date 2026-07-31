import { z } from 'zod';

export const createDrawEventSchema = z.object({
  organizationId: z.string().uuid(),
  committeeMonthId: z.string().uuid(),
  drawDate: z.string().min(1, 'Draw date required'),
  conductedById: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const createDrawResultSchema = z.object({
  organizationId: z.string().uuid(),
  drawEventId: z.string().uuid(),
  tokenId: z.string().uuid(),
  rewardType: z.enum([
    'LUCKY_WINNER', 
    'GIFT_WINNER', 
    'PREVIOUS_TOKEN_REWARD', 
    'NEXT_TOKEN_REWARD', 
    'WHOLE_LINE_REWARD', 
    'CASH_REWARD', 
    'SPECIAL_REWARD'
  ]),
  rewardDescription: z.string().optional(),
});

export type CreateDrawEventDTO = z.infer<typeof createDrawEventSchema>;
export type CreateDrawResultDTO = z.infer<typeof createDrawResultSchema>;
