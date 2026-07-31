import { eq, and } from 'drizzle-orm';
import { committees, committeeRules, NewCommittee } from '../../../../packages/db/src/schema/committees';
import { committeeMonths } from '../../../../packages/db/src/schema/committee_months';

export class CommitteeRepository {
  constructor(private db: any) {}

  async findById(organizationId: string, id: string) {
    const results = await this.db
      .select()
      .from(committees)
      .where(and(eq(committees.organizationId, organizationId), eq(committees.id, id)))
      .limit(1);
    return results[0] || null;
  }

  async findByCode(organizationId: string, code: string) {
    const results = await this.db
      .select()
      .from(committees)
      .where(and(eq(committees.organizationId, organizationId), eq(committees.code, code)))
      .limit(1);
    return results[0] || null;
  }

  async create(data: NewCommittee) {
    const results = await this.db.insert(committees).values(data).returning();
    return results[0];
  }

  async createRules(committeeId: string, organizationId: string, rulesJsonb: any) {
    const results = await this.db
      .insert(committeeRules)
      .values({ organizationId, committeeId, rulesJsonb })
      .returning();
    return results[0];
  }

  async generateMonths(organizationId: string, committeeId: string, totalMonths: number, startDateStr: string) {
    const startDate = new Date(startDateStr);
    const monthsData = [];

    for (let m = 1; m <= totalMonths; m++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(startDate.getMonth() + (m - 1));

      monthsData.push({
        organizationId,
        committeeId,
        monthNumber: m,
        monthName: `Month ${m}`,
        dueDate: dueDate.toISOString().slice(0, 10),
      });
    }

    return await this.db.insert(committeeMonths).values(monthsData).returning();
  }

  async list(organizationId: string) {
    return await this.db.select().from(committees).where(eq(committees.organizationId, organizationId));
  }
}
