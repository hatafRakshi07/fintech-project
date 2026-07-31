import { LoanService } from '../services/LoanService';
import { createLoanSchema } from '../dto/LoanDTO';

export class LoanController {
  constructor(private loanService: LoanService) {}

  async createLoan(req: any, res: any) {
    try {
      const validatedDTO = createLoanSchema.parse(req.body);
      const loan = await this.loanService.createLoan(validatedDTO as any);
      return res.status(201).json({ success: true, data: loan });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
