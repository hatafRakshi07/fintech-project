import { CommitteeService } from '../services/CommitteeService';
import { createCommitteeSchema } from '../dto/CommitteeDTO';

export class CommitteeController {
  constructor(private committeeService: CommitteeService) {}

  async getCommittee(req: any, res: any) {
    try {
      const { organizationId } = req.params;
      const { id } = req.query;
      const committee = await this.committeeService.getCommitteeById(organizationId, id as string);
      return res.status(200).json({ success: true, data: committee });
    } catch (err: any) {
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  async createCommittee(req: any, res: any) {
    try {
      const validatedDTO = createCommitteeSchema.parse(req.body);
      const committee = await this.committeeService.createCommittee(validatedDTO as any);
      return res.status(201).json({ success: true, data: committee });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async listCommittees(req: any, res: any) {
    try {
      const { organizationId } = req.params;
      const list = await this.committeeService.listCommittees(organizationId);
      return res.status(200).json({ success: true, data: list });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
