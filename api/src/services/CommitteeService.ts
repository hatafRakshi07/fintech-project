import { CommitteeRepository } from '../repositories/CommitteeRepository';
import { CreateCommitteeDTO } from '../dto/CommitteeDTO';

export class CommitteeService {
  constructor(private committeeRepo: CommitteeRepository) {}

  async createCommittee(dto: CreateCommitteeDTO) {
    const existing = await this.committeeRepo.findByCode(dto.organizationId, dto.code);
    if (existing) {
      throw new Error(`Committee with code ${dto.code} already exists.`);
    }

    const committee = await this.committeeRepo.create({
      organizationId: dto.organizationId,
      name: dto.name,
      code: dto.code,
      totalMembers: dto.totalMembers,
      totalMonths: dto.totalMonths,
      monthlyInstallment: dto.monthlyInstallment.toFixed(2),
      startDate: dto.startDate,
    });

    const defaultRules = {
      loan_percentage: 75,
      minimum_paid_months: 1,
      maximum_open_loans: 1,
      lucky_draw_action: 'MARK_OUT',
      gift_winner_action: 'REMAIN_ACTIVE',
      cash_alternative_enabled: true,
      ...dto.rules,
    };

    await this.committeeRepo.createRules(committee.id, dto.organizationId, defaultRules);
    await this.committeeRepo.generateMonths(dto.organizationId, committee.id, dto.totalMonths, dto.startDate);

    return committee;
  }

  async getCommitteeById(organizationId: string, id: string) {
    const committee = await this.committeeRepo.findById(organizationId, id);
    if (!committee) {
      throw new Error(`Committee with ID ${id} not found.`);
    }
    return committee;
  }

  async listCommittees(organizationId: string) {
    return await this.committeeRepo.list(organizationId);
  }
}
