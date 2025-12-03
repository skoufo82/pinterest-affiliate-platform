import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPriceStale,
  formatPriceUpdateTime,
  getPriceDisplayText,
  shouldShowStaleWarning,
} from './priceDisplay';

describe('priceDisplay utilities', () => {
  beforeEach(() => {
    // Mock current date to 2024-01-15 12:00:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isPriceStale', () => {
    it('should return false when priceLastUpdated is undefined', () => {
      expect(isPriceStale(undefined)).toBe(false);
    });

    it('should return false when price was updated within 7 days', () => {
      const recentDate = new Date('2024-01-10T12:00:00Z').toISOString();
      expect(isPriceStale(recentDate)).toBe(false);
    });

    it('should return true when price was updated more than 7 days ago', () => {
      const oldDate = new Date('2024-01-01T12:00:00Z').toISOString();
      expect(isPriceStale(oldDate)).toBe(true);
    });

    it('should return false when price was updated exactly 7 days ago', () => {
      const exactDate = new Date('2024-01-08T12:00:00Z').toISOString();
      expect(isPriceStale(exactDate)).toBe(false);
    });
  });

  describe('formatPriceUpdateTime', () => {
    it('should return empty string when priceLastUpdated is undefined', () => {
      expect(formatPriceUpdateTime(undefined)).toBe('');
    });

    it('should format minutes ago correctly', () => {
      const date = new Date('2024-01-15T11:45:00Z').toISOString();
      expect(formatPriceUpdateTime(date)).toBe('15 minutes ago');
    });

    it('should format 1 minute ago correctly', () => {
      const date = new Date('2024-01-15T11:59:00Z').toISOString();
      expect(formatPriceUpdateTime(date)).toBe('1 minute ago');
    });

    it('should format hours ago correctly', () => {
      const date = new Date('2024-01-15T09:00:00Z').toISOString();
      expect(formatPriceUpdateTime(date)).toBe('3 hours ago');
    });

    it('should format 1 hour ago correctly', () => {
      const date = new Date('2024-01-15T11:00:00Z').toISOString();
      expect(formatPriceUpdateTime(date)).toBe('1 hour ago');
    });

    it('should format days ago correctly', () => {
      const date = new Date('2024-01-12T12:00:00Z').toISOString();
      expect(formatPriceUpdateTime(date)).toBe('3 days ago');
    });

    it('should format 1 day ago correctly', () => {
      const date = new Date('2024-01-14T12:00:00Z').toISOString();
      expect(formatPriceUpdateTime(date)).toBe('1 day ago');
    });

    it('should format dates older than 7 days with month and day', () => {
      const date = new Date('2024-01-01T12:00:00Z').toISOString();
      expect(formatPriceUpdateTime(date)).toBe('Jan 1');
    });

    it('should include year for dates from previous year', () => {
      const date = new Date('2023-12-01T12:00:00Z').toISOString();
      expect(formatPriceUpdateTime(date)).toBe('Dec 1, 2023');
    });
  });

  describe('getPriceDisplayText', () => {
    it('should return the price when provided', () => {
      expect(getPriceDisplayText('$29.99')).toBe('$29.99');
    });

    it('should return "Price not available" when price is undefined', () => {
      expect(getPriceDisplayText(undefined)).toBe('Price not available');
    });

    it('should return "Price not available" when price is empty string', () => {
      expect(getPriceDisplayText('')).toBe('Price not available');
    });
  });

  describe('shouldShowStaleWarning', () => {
    it('should return false when price is undefined', () => {
      const oldDate = new Date('2024-01-01T12:00:00Z').toISOString();
      expect(shouldShowStaleWarning(undefined, oldDate)).toBe(false);
    });

    it('should return false when price is empty string', () => {
      const oldDate = new Date('2024-01-01T12:00:00Z').toISOString();
      expect(shouldShowStaleWarning('', oldDate)).toBe(false);
    });

    it('should return false when priceLastUpdated is undefined', () => {
      expect(shouldShowStaleWarning('$29.99', undefined)).toBe(false);
    });

    it('should return false when price is recent', () => {
      const recentDate = new Date('2024-01-10T12:00:00Z').toISOString();
      expect(shouldShowStaleWarning('$29.99', recentDate)).toBe(false);
    });

    it('should return true when price exists and is stale', () => {
      const oldDate = new Date('2024-01-01T12:00:00Z').toISOString();
      expect(shouldShowStaleWarning('$29.99', oldDate)).toBe(true);
    });
  });
});
