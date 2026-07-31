import { TokenRepository } from '../repositories/TokenRepository';
import { NewToken } from '../../../../packages/db/src/schema/tokens';

export class TokenService {
  constructor(private tokenRepo: TokenRepository) {}

  /**
   * Token Normalization helper:
   * Converts '29½', '29.5', '029' -> base 29
   * Assigns auto-duplicate suffix if base 29 already exists in committee
   */
  parseTokenNumber(raw: string): { normalized: number; suffix: string } {
    const trimmed = raw.trim();
    let normalized = 0;
    let suffix = '';

    if (/^[0-9]+[\s\-\/]+[A-Za-z0-9]+$/.test(trimmed)) {
      normalized = parseInt(trimmed.replace(/^([0-9]+).*$/, '$1'), 10);
      suffix = trimmed.replace(/^[0-9]+[\s\-\/]+([A-Za-z0-9]+)$/, '$1').toUpperCase();
    } else {
      const match = trimmed.replace(/^0*([0-9]+).*$/, '$1');
      normalized = parseInt(match || '0', 10);
    }

    return { normalized, suffix };
  }

  async createToken(data: NewToken) {
    const { normalized, suffix } = this.parseTokenNumber(data.rawTokenNumber);
    data.normalizedTokenNumber = normalized;

    if (suffix) {
      data.duplicateSuffix = suffix;
    } else {
      const existing = await this.tokenRepo.findByCommitteeAndNormalized(data.committeeId, normalized);
      if (existing.length > 0) {
        const suffixes = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
        data.duplicateSuffix = existing.length <= 26 ? suffixes[existing.length - 1] : `A${existing.length}`;
      }
    }

    return await this.tokenRepo.create(data);
  }

  async getTokenById(organizationId: string, id: string) {
    const token = await this.tokenRepo.findById(organizationId, id);
    if (!token) {
      throw new Error(`Token with ID ${id} not found.`);
    }
    return token;
  }
}
