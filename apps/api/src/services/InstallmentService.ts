import { InstallmentRepository } from '../repositories/InstallmentRepository';
import { CreateInstallmentDTO } from '../dto/InstallmentDTO';

export class InstallmentService {
  constructor(private installmentRepo: InstallmentRepository, private tokenRepo: any) {}

  async createInstallment(dto: CreateInstallmentDTO) {
    const token = await this.tokenRepo.findById(dto.organizationId, dto.tokenId);
    if (!token) {
      throw new Error(`Token ${dto.tokenId} not found.`);
    }

    if (token.status === 'OUT') {
      throw new Error(`Cannot record payment for token ${dto.tokenId} which is OUT.`);
    }

    const existingReceipt = await this.installmentRepo.findByReceiptNumber(dto.receiptNumber);
    if (existingReceipt) {
      throw new Error(`Receipt number ${dto.receiptNumber} already exists.`);
    }

    return await this.installmentRepo.create({
      organizationId: dto.organizationId,
      committeeMonthId: dto.committeeMonthId,
      tokenId: dto.tokenId,
      receiptNumber: dto.receiptNumber,
      expectedAmount: dto.expectedAmount.toFixed(2),
      paidAmount: dto.paidAmount.toFixed(2),
      paymentDate: dto.paymentDate,
      paymentMode: dto.paymentMode,
      collectorId: dto.collectorId,
      idempotencyKey: dto.idempotencyKey,
      notes: dto.notes,
    });
  }
}
