import { describe, it, expect } from 'vitest';
import { CreateCommentSchema } from '../comment.schema';

describe('CreateCommentSchema', () => {
  describe('Valid inputs', () => {
    it('should accept valid comment with content exactly 1 character', () => {
      const result = CreateCommentSchema.safeParse({
        content: 'a',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid comment with content exactly 2000 characters', () => {
      const result = CreateCommentSchema.safeParse({
        content: 'a'.repeat(2000),
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid comment with short content', () => {
      const result = CreateCommentSchema.safeParse({
        content: 'This is a comment',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid comment with long content', () => {
      const content = 'a'.repeat(1500);
      const result = CreateCommentSchema.safeParse({
        content,
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid comment with leading and trailing whitespace', () => {
      const result = CreateCommentSchema.safeParse({
        content: '  test comment  ',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Invalid content', () => {
    it('should reject empty content', () => {
      const result = CreateCommentSchema.safeParse({
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content cannot be empty');
    });

    it('should reject content above maximum length (more than 2000 characters)', () => {
      const result = CreateCommentSchema.safeParse({
        content: 'a'.repeat(2001),
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content must not exceed 2000 characters');
    });

    it('should reject missing content', () => {
      const result = CreateCommentSchema.safeParse({});

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content is required');
    });

    it('should reject whitespace-only content', () => {
      const result = CreateCommentSchema.safeParse({
        content: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content cannot consist of only whitespace');
    });

    it('should reject whitespace-only content with mixed whitespace characters', () => {
      const result = CreateCommentSchema.safeParse({
        content: '\t\n  ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Comment content cannot consist of only whitespace');
    });
  });
});
