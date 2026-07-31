import { TokenService } from '../services/TokenService';
import { createTokenSchema } from '../dto/TokenDTO';

export class TokenController {
  constructor(private tokenService: TokenService) {}

  async getToken(req: any, res: any) {
    try {
      const { organizationId } = req.params;
      const { id } = req.query;
      const token = await this.tokenService.getTokenById(organizationId, id as string);
      return res.status(200).json({ success: true, data: token });
    } catch (err: any) {
      return res.status(404).json({ success: false, error: err.message });
    }
  }

  async createToken(req: any, res: any) {
    try {
      // Level 1: Request DTO Validation
      const validatedDTO = createTokenSchema.parse(req.body);
      // Level 2: Service Layer Business Validation & Fraction Parsing / Suffix Assignment
      const token = await this.tokenService.createToken(validatedDTO as any);
      return res.status(201).json({ success: true, data: token });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }
}
