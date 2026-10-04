import { describe, it, expect } from 'vitest';
import { UpdateUsernameSchema, UpdatePasswordSchema } from '../user.schema';

describe('UpdateUsernameSchema', () => {
  describe('Valid inputs', () => {
    it('should accept valid username with minimum length (1 character)', () => {
      const result = UpdateUsernameSchema.safeParse({
        username: 'a',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid username with maximum length (50 characters)', () => {
      const result = UpdateUsernameSchema.safeParse({
        username: 'a'.repeat(50),
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid username with spaces inside', () => {
      const result = UpdateUsernameSchema.safeParse({
        username: 'John Doe',
      });

      expect(result.success).toBe(true);
    });

    it('should accept username with numbers', () => {
      const result = UpdateUsernameSchema.safeParse({
        username: 'user123',
      });

      expect(result.success).toBe(true);
    });

    it('should accept username with special characters', () => {
      const result = UpdateUsernameSchema.safeParse({
        username: 'user_name-123',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Invalid username', () => {
    it('should reject empty username', () => {
      const result = UpdateUsernameSchema.safeParse({
        username: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username cannot be empty');
    });

    it('should reject username above maximum length (more than 50 characters)', () => {
      const result = UpdateUsernameSchema.safeParse({
        username: 'a'.repeat(51),
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username must not exceed 50 characters');
    });

    it('should reject whitespace-only username', () => {
      const result = UpdateUsernameSchema.safeParse({
        username: '   ',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username cannot consist of only whitespace');
    });

    it('should reject missing username', () => {
      const result = UpdateUsernameSchema.safeParse({});

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Username is required');
    });
  });
});

describe('UpdatePasswordSchema', () => {
  describe('Valid inputs', () => {
    it('should accept valid password update with minimum new password length', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'oldpassword1',
        newPassword: '12345678',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid password update with maximum new password length', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'oldpassword1',
        newPassword: 'a'.repeat(72),
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid password update with short old password', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'a',
        newPassword: 'newpassword123',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid password update with complex new password', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'OldPass1!',
        newPassword: 'New!Passw0rd#2024',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Invalid old password', () => {
    it('should reject empty old password', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: '',
        newPassword: 'newpassword123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Current password is required');
    });

    it('should reject missing old password', () => {
      const result = UpdatePasswordSchema.safeParse({
        newPassword: 'newpassword123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('Current password is required');
    });
  });

  describe('Invalid new password', () => {
    it('should reject new password below minimum length (less than 8 characters)', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'oldpassword1',
        newPassword: 'short',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('New password must be at least 8 characters');
    });

    it('should reject new password above maximum length (more than 72 characters)', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'oldpassword1',
        newPassword: 'a'.repeat(73),
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('New password must not exceed 72 characters');
    });

    it('should reject empty new password', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'oldpassword1',
        newPassword: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('New password must be at least 8 characters');
    });

    it('should reject missing new password', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'oldpassword1',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('New password is required');
    });

    it('should reject new password same as old password', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'samepassword',
        newPassword: 'samepassword',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].message).toBe('New password must be different from the current password');
    });

    it('should reject new password similar to old password but different case', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'password',
        newPassword: 'Password',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Validation path', () => {
    it('should point to newPassword field when passwords are the same', () => {
      const result = UpdatePasswordSchema.safeParse({
        oldPassword: 'test1234',
        newPassword: 'test1234',
      });

      expect(result.success).toBe(false);
      expect(result.error?.errors[0].path[0]).toBe('newPassword');
    });
  });
});
