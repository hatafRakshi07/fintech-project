import { z } from 'zod';

export const uploadImportJobSchema = z.object({
  organizationId: z.string().uuid(),
  fileName: z.string().min(1, 'File name is required'),
  fileData: z.string().min(1, 'Base64 file data is required'),
});

export type UploadImportJobDTO = z.infer<typeof uploadImportJobSchema>;
