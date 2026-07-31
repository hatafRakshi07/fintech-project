import { z } from 'zod';

export const createCustomerSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100),
  fatherName: z.string().max(100).optional(),
  mobile: z.string().min(10, 'Valid mobile number required').max(20),
  altMobile: z.string().max(20).optional(),
  aadhaar: z.string().max(20).optional(),
  address: z.string().optional(),
  city: z.string().max(50).optional(),
  photoUrl: z.string().url().optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerDTO = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDTO = z.infer<typeof updateCustomerSchema>;
