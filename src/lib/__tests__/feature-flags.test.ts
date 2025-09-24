/**
 * @jest-environment jsdom
 */

import { isGoogleAuthDisabled, isAlphaStage } from '../feature-flags';

// Mock process.env
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('Feature Flags', () => {
  describe('isGoogleAuthDisabled', () => {
    it('should return true when NEXT_PUBLIC_STAGE is alpha', () => {
      process.env.NEXT_PUBLIC_STAGE = 'alpha';
      expect(isGoogleAuthDisabled()).toBe(true);
    });

    it('should return false when NEXT_PUBLIC_STAGE is beta', () => {
      process.env.NEXT_PUBLIC_STAGE = 'beta';
      expect(isGoogleAuthDisabled()).toBe(false);
    });

    it('should return false when NEXT_PUBLIC_STAGE is production', () => {
      process.env.NEXT_PUBLIC_STAGE = 'production';
      expect(isGoogleAuthDisabled()).toBe(false);
    });

    it('should return false when NEXT_PUBLIC_STAGE is undefined', () => {
      delete process.env.NEXT_PUBLIC_STAGE;
      expect(isGoogleAuthDisabled()).toBe(false);
    });
  });

  describe('isAlphaStage', () => {
    it('should return true when NEXT_PUBLIC_STAGE is alpha', () => {
      process.env.NEXT_PUBLIC_STAGE = 'alpha';
      expect(isAlphaStage()).toBe(true);
    });

    it('should return false when NEXT_PUBLIC_STAGE is not alpha', () => {
      process.env.NEXT_PUBLIC_STAGE = 'beta';
      expect(isAlphaStage()).toBe(false);
    });
  });
});