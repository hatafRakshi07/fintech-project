import { eq, and } from 'drizzle-orm';
import { installments, NewInstallment } from '../../../../packages/db/src/schema/installments';

export class InstallmentRepository {
  constructor(private db: any) {}

  async findByReceiptNumber(receiptNumber: string) {
    const results = await this.db.select().from(installments).where(eq(installments.receiptNumber, receiptNumber)).limit(1);
    return results[0] || null;
  }

  async create(data: NewInstallment) {
    const results = await this.db.insert(installments).values(data).returning();
    return results[0];
  }

  async listByToken(tokenId: string) {
    return await this.db.select().from(installments).where(eq(installments.tokenId, tokenId));
  }
}
