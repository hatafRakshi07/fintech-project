import { CustomerRepository } from '../repositories/CustomerRepository';
import { NewCustomer } from '../../../../packages/db/src/schema/customers';

export class CustomerService {
  constructor(private customerRepo: CustomerRepository) {}

  /**
   * Idempotent 4-Tier Customer Resolution:
   * Tier 1: Match by Aadhaar
   * Tier 2: Match by Mobile
   * Tier 3: Match by Name + Father Name
   * Tier 4: Create new record
   */
  async getOrCreateCustomer(data: NewCustomer) {
    const { organizationId, name, fatherName, mobile, aadhaar } = data;

    if (aadhaar) {
      const existingByAadhaar = await this.customerRepo.findByAadhaar(organizationId, aadhaar);
      if (existingByAadhaar) return existingByAadhaar;
    }

    if (mobile) {
      const existingByMobile = await this.customerRepo.findByMobile(organizationId, mobile);
      if (existingByMobile) return existingByMobile;
    }

    if (fatherName) {
      const existingByNameFather = await this.customerRepo.findByNameAndFatherName(organizationId, name, fatherName);
      if (existingByNameFather) return existingByNameFather;
    }

    return await this.customerRepo.create(data);
  }

  async getCustomerById(organizationId: string, id: string) {
    const customer = await this.customerRepo.findById(organizationId, id);
    if (!customer) {
      throw new Error(`Customer with ID ${id} not found.`);
    }
    return customer;
  }

  async listCustomers(organizationId: string, limit = 50, offset = 0) {
    return await this.customerRepo.list(organizationId, limit, offset);
  }
}
