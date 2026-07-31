import { CustomerService } from '../services/CustomerService';
import { createCustomerSchema } from '../dto/CustomerDTO';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  async getCustomer(req: any, res: any) {
    try {
      const { organizationId } = req.params;
      const { id } = req.query;
      const customer = await this.customerService.getCustomerById(organizationId, id as string);
      return res.status(200).json({ success: true, data: customer });
    } catch (err: any) {
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  async createOrResolveCustomer(req: any, res: any) {
    try {
      // Level 1: Request DTO Validation
      const validatedDTO = createCustomerSchema.parse(req.body);
      // Level 2: Service Layer Business Validation & 4-Tier Match
      const customer = await this.customerService.getOrCreateCustomer(validatedDTO as any);
      return res.status(201).json({ success: true, data: customer });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  async listCustomers(req: any, res: any) {
    try {
      const { organizationId } = req.params;
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      const list = await this.customerService.listCustomers(organizationId, limit, offset);
      return res.status(200).json({ success: true, data: list });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
