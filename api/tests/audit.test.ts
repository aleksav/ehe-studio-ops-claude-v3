import { describe, it, expect } from 'vitest';
import { buildCreateAuditFields, buildUpdateAuditFields, buildDeleteAuditFields } from '../src/services/audit.service';

describe('Audit service', () => {
  it('buildCreateAuditFields stores full entity as after', () => {
    const entity = { id: '1', name: 'Test', email: 'test@example.com' };
    const result = buildCreateAuditFields(entity);
    expect(result).toEqual({ after: entity });
  });

  it('buildDeleteAuditFields stores full entity as before', () => {
    const entity = { id: '1', name: 'Test', email: 'test@example.com' };
    const result = buildDeleteAuditFields(entity);
    expect(result).toEqual({ before: entity });
  });

  it('buildUpdateAuditFields detects changed fields', () => {
    const before = { id: '1', name: 'Old', email: 'test@example.com' };
    const after = { id: '1', name: 'New', email: 'test@example.com' };
    const result = buildUpdateAuditFields(before, after);
    expect(result).toEqual({ name: { before: 'Old', after: 'New' } });
  });

  it('buildUpdateAuditFields returns null when no changes', () => {
    const before = { id: '1', name: 'Same' };
    const after = { id: '1', name: 'Same' };
    const result = buildUpdateAuditFields(before, after);
    expect(result).toBeNull();
  });
});
