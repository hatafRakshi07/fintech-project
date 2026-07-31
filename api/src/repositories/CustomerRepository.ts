import { eq, and, sql, isNull } from 'drizzle-orm';
import { customers, NewCustomer } from '../../../../packages/db/src/schema/customers';

export class CustomerRepository {
  constructor(private db: any) {}

  async findById(organizationId: string, id: string) {
    const results = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.organizationId, organizationId), eq(customers.id, id), isNull(customers.deletedAt)))
      .limit(1);
    return results[0] || null;
  }

  async findByAadhaar(organizationId: string, aadhaar: string) {
    const results = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.organizationId, organizationId), eq(customers.aadhaar, aadhaar), isNull(customers.deletedAt)))
      .limit(1);
    return results[0] || null;
  }

  async findByMobile(organizationId: string, mobile: string) {
    const results = await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.organizationId, organizationId), eq(customers.mobile, mobile), isNull(customers.deletedAt)))
      .limit(1);
    return results[0] || null;
  }

  async findByNameAndFatherName(organizationId: string, name: string, fatherName: string) {
    const results = await this.db
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.organizationId, organizationId),
          sql`LOWER(${customers.name}) = LOWER(${name})`,
          sql`LOWER(${customers.fatherName}) = LOWER(${fatherName})`,
          isNull(customers.deletedAt)
        )
      )
      .limit(1);
    return results[0] || null;
  }

  async create(data: NewCustomer) {
    const results = await this.db.insert(customers).values(data).returning();
    return results[0];
  }

  async list(organizationId: string, limit = 50, offset = 0) {
    return await this.db
      .select()
      .from(customers)
      .where(and(eq(customers.organizationId, organizationId), isNull(customers.deletedAt)))
      .limit(limit)
      .offset(offset);
  }
}
