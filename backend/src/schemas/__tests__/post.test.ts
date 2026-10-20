import { describe, it, expect } from 'vitest';
import { CreatePostSchema, UpdatePostSchema } from '../post.schema';

describe('CreatePostSchema', () => {
  describe('Valid inputs', () => {
    it('should accept valid post with minimum title length', () => {
      const result = CreatePostSchema.safeParse({
        title: 'a',
        content: 'This is post content',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid post with maximum title length', () => {
      const result = CreatePostSchema.safeParse({
        title: 'a'.repeat(200),
        content: 'This is post content',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid post with content exactly 1 character', () => {
      const result = CreatePostSchema.safeParse({
        title: 'Test Post',
        content: 'a',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid post with long content', () => {
      const result = CreatePostSchema.safeParse({
        title: 'Test Post',
        content: 'a'.repeat(5000),
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Invalid title', () => {
    it('should reject empty title', () => {
      const result = CreatePostSchema.safeParse({
        title: '',
        content: 'This is post content',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Title cannot be empty');
    });

    it('should reject title below minimum length', () => {
      const result = CreatePostSchema.safeParse({
        title: '',
        content: 'This is post content',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Title cannot be empty');
    });

    it('should reject title above maximum length', () => {
      const result = CreatePostSchema.safeParse({
        title: 'a'.repeat(201),
        content: 'This is post content',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Title must not exceed 200 characters');
    });

    it('should reject whitespace-only title', () => {
      const result = CreatePostSchema.safeParse({
        title: '   ',
        content: 'This is post content',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Title cannot consist of only whitespace');
    });

    it('should reject missing title', () => {
      const result = CreatePostSchema.safeParse({
        content: 'This is post content',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Title is required');
    });
  });

  describe('Invalid content', () => {
    it('should reject empty content', () => {
      const result = CreatePostSchema.safeParse({
        title: 'Test Post',
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Content cannot be empty');
    });

    it('should reject whitespace-only content', () => {
      const result = CreatePostSchema.safeParse({
        title: 'Test Post',
        content: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Content cannot consist of only whitespace');
    });

    it('should reject missing content', () => {
      const result = CreatePostSchema.safeParse({
        title: 'Test Post',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Content is required');
    });
  });
});

describe('UpdatePostSchema', () => {
  describe('Valid inputs', () => {
    it('should accept update with only title', () => {
      const result = UpdatePostSchema.safeParse({
        title: 'Updated Title',
      });

      expect(result.success).toBe(true);
    });

    it('should accept update with only content', () => {
      const result = UpdatePostSchema.safeParse({
        content: 'Updated content here',
      });

      expect(result.success).toBe(true);
    });

    it('should accept update with both title and content', () => {
      const result = UpdatePostSchema.safeParse({
        title: 'Updated Title',
        content: 'Updated content here',
      });

      expect(result.success).toBe(true);
    });

    it('should accept update with minimum title length', () => {
      const result = UpdatePostSchema.safeParse({
        title: 'a',
      });

      expect(result.success).toBe(true);
    });

    it('should accept update with maximum title length', () => {
      const result = UpdatePostSchema.safeParse({
        title: 'a'.repeat(200),
      });

      expect(result.success).toBe(true);
    });

    it('should accept update with content exactly 1 character', () => {
      const result = UpdatePostSchema.safeParse({
        content: 'a',
      });

      expect(result.success).toBe(true);
    });

    it('should accept update with empty title (whitespace only)', () => {
      const result = UpdatePostSchema.safeParse({
        title: '',
      });

      expect(result.success).toBe(false);
    });

    it('should accept update with empty content (whitespace only)', () => {
      const result = UpdatePostSchema.safeParse({
        content: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('Invalid title', () => {
    it('should reject title above maximum length', () => {
      const result = UpdatePostSchema.safeParse({
        title: 'a'.repeat(201),
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Title must not exceed 200 characters');
    });

    it('should reject whitespace-only title', () => {
      const result = UpdatePostSchema.safeParse({
        title: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Title cannot consist of only whitespace');
    });
  });

  describe('Invalid content', () => {
    it('should reject empty content', () => {
      const result = UpdatePostSchema.safeParse({
        content: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Content cannot be empty');
    });

    it('should reject whitespace-only content', () => {
      const result = UpdatePostSchema.safeParse({
        content: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Content cannot consist of only whitespace');
    });
  });

  describe('Missing fields', () => {
    it('should reject update with no fields provided', () => {
      const result = UpdatePostSchema.safeParse({});

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('At least one of title, content, or tags must be provided');
    });
  });
});
