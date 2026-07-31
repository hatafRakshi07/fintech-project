import { InstallmentService } from '../services/InstallmentService';
import { createInstallmentSchema } from '../dto/InstallmentDTO';

export class InstallmentController {
  constructor(private installmentService: InstallmentService) {}

  async createInstallment(req: any, res: any) {
    try {
      const validatedDTO = createInstallmentSchema.parse(req.body);
      const installment = await this.installmentService.createInstallment(validatedDTO as any);
      return res.status(201).json({ success: true, data: installment });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
