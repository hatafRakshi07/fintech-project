import { LoanRepository } from '../repositories/LoanRepository';
import { CreateLoanDTO } from '../dto/LoanDTO';

export class LoanService {
  constructor(private loanRepo: LoanRepository, private installmentRepo: any) {}

  async createLoan(dto: CreateLoanDTO) {
    const openLoans = await this.loanRepo.findOpenLoansByToken(dto.tokenId);
    if (openLoans.length >= 1) {
      throw new Error(`Token ${dto.tokenId} already has an open loan.`);
    }

    const installments = await this.installmentRepo.listByToken(dto.tokenId);
    if (installments.length < 1) {
      throw new Error(`Token ${dto.tokenId} requires at least 1 paid month for loan eligibility.`);
    }

    const totalPaid = installments.reduce((acc: number, i: any) => acc + parseFloat(i.paidAmount), 0);
    const maxAllowed = (totalPaid * 75) / 100;

    if (dto.principalAmount > maxAllowed) {
      throw new Error(`Requested loan amount (₹${dto.principalAmount}) exceeds max eligibility (₹${maxAllowed}).`);
    }

    return await this.loanRepo.create({
      organizationId: dto.organizationId,
      committeeId: dto.committeeId,
      customerId: dto.customerId,
      tokenId: dto.tokenId,
      principalAmount: dto.principalAmount.toFixed(2),
      interestRatePct: dto.interestRatePct.toFixed(2),
      tenureMonths: dto.tenureMonths,
      disbursalDate: dto.disbursalDate,
      notes: dto.notes,
    });
  }
}
