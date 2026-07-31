import { eq, and } from 'drizzle-orm';
import { loans, NewLoan, loanRepayments } from '../../../../packages/db/src/schema/loans';

export class LoanRepository {
  constructor(private db: any) {}

  async findById(organizationId: string, id: string) {
    const results = await this.db.select().from(loans).where(and(eq(loans.organizationId, organizationId), eq(loans.id, id))).limit(1);
    return results[0] || null;
  }

  async findOpenLoansByToken(tokenId: string) {
    return await this.db.select().from(loans).where(and(eq(loans.tokenId, tokenId)));
  }

  async create(data: NewLoan) {
    const results = await this.db.insert(loans).values(data).returning();
    return results[0];
  }
}
