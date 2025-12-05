import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { AnalyticsEvent } from './types';

// In-memory storage for testing
const testState = {
  events: new Map<string, AnalyticsEvent>(),
  eventsByCreator: new Map<string, AnalyticsEvent[]>(),
};

// Mock the DynamoDB client with a function that accesses testState
const mockSend = vi.fn(async (command: any) => {
  const input = command.input;
  
  // Handle PutCommand (tracking events)
  if (input?.Item) {
    const event = input.Item as AnalyticsEvent;
    testState.events.set(event.id, event);
    
    // Add to creator's events
    const creatorEvents = testState.eventsByCreator.get(event.creatorId) || [];
    creatorEvents.push(event);
    testState.eventsByCreator.set(event.creatorId, creatorEvents);
    
    return {};
  }
  
  // Handle QueryCommand (getting events by creator)
  if (input?.KeyConditionExpression && input?.ExpressionAttributeValues?.[':creatorId']) {
    const creatorId = input.ExpressionAttributeValues[':creatorId'];
    const events = testState.eventsByCreator.get(creatorId) || [];
    return { Items: events };
  }
  
  return { Items: [] };
});

// Mock AWS SDK before importing
vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn(() => ({})),
}));

vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: vi.fn(() => ({
      send: mockSend,
    })),
  },
  PutCommand: vi.fn((params) => ({ input: params })),
  QueryCommand: vi.fn((params) => ({ input: params })),
}));

// Import after mocking
const { trackPageView, trackAffiliateClick, getEventsByCreator } = await import('./analyticsTracking');

describe('Analytics Tracking - Property Tests', () => {
  beforeEach(() => {
    testState.events.clear();
    testState.eventsByCreator.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Feature: multi-creator-platform, Property 14: Analytics Event Recording
   * Validates: Requirements 7.1
   * 
   * Property: For any page view on a creator's landing page, an analytics event must be created 
   * with the correct creatorId and timestamp.
   */
  it('should record page view events with correct creatorId and timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random creator IDs
        fc.uuid(),
        // Generate random metadata
        fc.record({
          userAgent: fc.option(fc.string({ minLength: 10, maxLength: 200 })),
          referrer: fc.option(fc.webUrl()),
          location: fc.option(fc.string({ minLength: 2, maxLength: 50 })),
        }),
        async (creatorId, metadata) => {
          // Reset state for this property test run
          testState.events.clear();
          testState.eventsByCreator.clear();
          
          // Record the time before tracking
          const beforeTimestamp = new Date().toISOString();
          
          // Track a page view
          const eventId = await trackPageView(creatorId, metadata);
          
          // Record the time after tracking
          const afterTimestamp = new Date().toISOString();
          
          // Retrieve the event
          const event = testState.events.get(eventId);
          
          // Property 1: Event must exist
          expect(event).toBeDefined();
          
          // Property 2: Event must have correct creatorId
          expect(event!.creatorId).toBe(creatorId);
          
          // Property 3: Event must have correct eventType
          expect(event!.eventType).toBe('page_view');
          
          // Property 4: Event timestamp must be between before and after timestamps
          expect(event!.timestamp >= beforeTimestamp).toBe(true);
          expect(event!.timestamp <= afterTimestamp).toBe(true);
          
          // Property 5: Event must have metadata
          expect(event!.metadata).toBeDefined();
          if (metadata.userAgent) {
            expect(event!.metadata.userAgent).toBe(metadata.userAgent);
          }
          if (metadata.referrer) {
            expect(event!.metadata.referrer).toBe(metadata.referrer);
          }
          if (metadata.location) {
            expect(event!.metadata.location).toBe(metadata.location);
          }
          
          // Property 6: Event must have TTL set (90 days from now)
          expect(event!.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
          
          // Property 7: Event must be retrievable by creatorId
          const creatorEvents = await getEventsByCreator(creatorId);
          expect(creatorEvents).toContainEqual(event);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any affiliate click, an analytics event must be created with the correct 
   * creatorId, productId, and timestamp.
   */
  it('should record affiliate click events with correct creatorId, productId, and timestamp', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random creator IDs and product IDs
        fc.uuid(),
        fc.uuid(),
        // Generate random metadata
        fc.record({
          userAgent: fc.option(fc.string({ minLength: 10, maxLength: 200 })),
          referrer: fc.option(fc.webUrl()),
          location: fc.option(fc.string({ minLength: 2, maxLength: 50 })),
        }),
        async (creatorId, productId, metadata) => {
          // Reset state for this property test run
          testState.events.clear();
          testState.eventsByCreator.clear();
          
          // Record the time before tracking
          const beforeTimestamp = new Date().toISOString();
          
          // Track an affiliate click
          const eventId = await trackAffiliateClick(creatorId, productId, metadata);
          
          // Record the time after tracking
          const afterTimestamp = new Date().toISOString();
          
          // Retrieve the event
          const event = testState.events.get(eventId);
          
          // Property 1: Event must exist
          expect(event).toBeDefined();
          
          // Property 2: Event must have correct creatorId
          expect(event!.creatorId).toBe(creatorId);
          
          // Property 3: Event must have correct productId
          expect(event!.productId).toBe(productId);
          
          // Property 4: Event must have correct eventType
          expect(event!.eventType).toBe('affiliate_click');
          
          // Property 5: Event timestamp must be between before and after timestamps
          expect(event!.timestamp >= beforeTimestamp).toBe(true);
          expect(event!.timestamp <= afterTimestamp).toBe(true);
          
          // Property 6: Event must have metadata
          expect(event!.metadata).toBeDefined();
          if (metadata.userAgent) {
            expect(event!.metadata.userAgent).toBe(metadata.userAgent);
          }
          if (metadata.referrer) {
            expect(event!.metadata.referrer).toBe(metadata.referrer);
          }
          if (metadata.location) {
            expect(event!.metadata.location).toBe(metadata.location);
          }
          
          // Property 7: Event must have TTL set (90 days from now)
          expect(event!.ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
          
          // Property 8: Event must be retrievable by creatorId
          const creatorEvents = await getEventsByCreator(creatorId);
          expect(creatorEvents).toContainEqual(event);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Multiple events for the same creator should all be retrievable
   */
  it('should store and retrieve multiple events for the same creator', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(
          fc.record({
            eventType: fc.constantFrom('page_view' as const, 'affiliate_click' as const),
            productId: fc.option(fc.uuid()),
            metadata: fc.record({
              userAgent: fc.option(fc.string({ minLength: 10, maxLength: 200 })),
              referrer: fc.option(fc.webUrl()),
              location: fc.option(fc.string({ minLength: 2, maxLength: 50 })),
            }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (creatorId, eventConfigs) => {
          // Reset state for this property test run
          testState.events.clear();
          testState.eventsByCreator.clear();
          
          const eventIds: string[] = [];
          
          // Track all events
          for (const config of eventConfigs) {
            let eventId: string;
            if (config.eventType === 'page_view') {
              eventId = await trackPageView(creatorId, config.metadata);
            } else {
              // For affiliate clicks, we need a productId
              const productId = config.productId || 'default-product-id';
              eventId = await trackAffiliateClick(creatorId, productId, config.metadata);
            }
            eventIds.push(eventId);
          }
          
          // Retrieve all events for the creator
          const creatorEvents = await getEventsByCreator(creatorId);
          
          // Property: All tracked events should be retrievable
          expect(creatorEvents.length).toBe(eventIds.length);
          
          // Property: All events should have the correct creatorId
          for (const event of creatorEvents) {
            expect(event.creatorId).toBe(creatorId);
          }
          
          // Property: All event IDs should be present
          const retrievedIds = creatorEvents.map(e => e.id);
          for (const eventId of eventIds) {
            expect(retrievedIds).toContain(eventId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
