import { describe, it, expect } from 'vitest';
import { RegisterSchema, LoginSchema } from '../auth.schema';

describe('RegisterSchema', () => {
  describe('Valid inputs', () => {
    it('should accept valid registration data with minimum username length', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: 'abc',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid registration data with maximum username length', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: 'a'.repeat(50),
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid registration data with password exactly 8 characters', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: 'testuser',
        password: '12345678',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid registration data with long password', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@domain.com',
        username: 'myusername',
        password: 'MyStr0ng!Passw0rd!2024',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid registration data with leading/trailing whitespace in username', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: '  testuser  ',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Invalid email', () => {
    it('should reject invalid email format', () => {
      const result = RegisterSchema.safeParse({
        email: 'invalid-email',
        username: 'testuser',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Email must be a valid email address');
    });

    it('should reject empty email', () => {
      const result = RegisterSchema.safeParse({
        email: '',
        username: 'testuser',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Email must be a valid email address');
    });

    it('should reject missing email', () => {
      const result = RegisterSchema.safeParse({
        username: 'testuser',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Email is required');
    });
  });

  describe('Invalid username', () => {
    it('should reject username below minimum length (less than 3 characters)', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: 'ab',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username must be at least 3 characters');
    });

    it('should reject username above maximum length (more than 50 characters)', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: 'a'.repeat(51),
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username must not exceed 50 characters');
    });

    it('should reject empty username', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: '',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username must be at least 3 characters');
    });

    it('should reject whitespace-only username', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: '   ',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username cannot consist of only whitespace');
    });

    it('should reject missing username', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username is required');
    });
  });

  describe('Invalid password', () => {
    it('should reject password below minimum length (less than 8 characters)', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: 'testuser',
        password: 'short',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Password must be at least 8 characters');
    });

    it('should reject empty password', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: 'testuser',
        password: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Password must be at least 8 characters');
    });

    it('should reject missing password', () => {
      const result = RegisterSchema.safeParse({
        email: 'test@example.com',
        username: 'testuser',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Password is required');
    });
  });
});

describe('LoginSchema', () => {
  describe('Valid inputs', () => {
    it('should accept login with email and password', () => {
      const result = LoginSchema.safeParse({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('should accept login with username and password', () => {
      const result = LoginSchema.safeParse({
        username: 'testuser',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('should accept login with both email and username', () => {
      const result = LoginSchema.safeParse({
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
      });

      expect(result.success).toBe(true);
    });

    it('should accept login with password exactly 1 character', () => {
      const result = LoginSchema.safeParse({
        email: 'test@example.com',
        password: 'p',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Missing credentials', () => {
    it('should reject login with neither email nor username', () => {
      const result = LoginSchema.safeParse({
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Either email or username must be provided');
    });

    it('should reject login with missing password', () => {
      const result = LoginSchema.safeParse({
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Password is required');
    });
  });

  describe('Invalid email format', () => {
    it('should reject invalid email format when email is provided', () => {
      const result = LoginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Email must be a valid email address');
    });
  });

  describe('Invalid username', () => {
    it('should reject empty username', () => {
      const result = LoginSchema.safeParse({
        username: '',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username cannot be empty');
    });

    it('should reject whitespace-only username', () => {
      const result = LoginSchema.safeParse({
        username: '   ',
        password: 'password123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username cannot consist of only whitespace');
    });
  });
});

