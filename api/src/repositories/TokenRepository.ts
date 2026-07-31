import { eq, and, isNull } from 'drizzle-orm';
import { tokens, NewToken } from '../../../../packages/db/src/schema/tokens';

export class TokenRepository {
  constructor(private db: any) {}

  async findById(organizationId: string, id: string) {
    const results = await this.db
      .select()
      .from(tokens)
      .where(and(eq(tokens.organizationId, organizationId), eq(tokens.id, id), isNull(tokens.deletedAt)))
      .limit(1);
    return results[0] || null;
  }

  async findByCommitteeAndNormalized(committeeId: string, normalizedTokenNumber: number) {
    return await this.db
      .select()
      .from(tokens)
      .where(
        and(
          eq(tokens.committeeId, committeeId),
          eq(tokens.normalizedTokenNumber, normalizedTokenNumber),
          isNull(tokens.deletedAt)
        )
      );
  }

  async create(data: NewToken) {
    const results = await this.db.insert(tokens).values(data).returning();
    return results[0];
  }
}
