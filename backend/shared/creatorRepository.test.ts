import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { CreateCreatorInput, UpdateCreatorInput } from './creatorRepository';
import { Creator } from './types';

// In-memory storage for testing
const testState = {
  creators: new Map<string, Creator>(),
  creatorsBySlug: new Map<string, Creator>(),
};

// Mock the DynamoDB client with a function that accesses testState
const mockSend = vi.fn(async (command: any) => {
  const input = command.input;
  
  // Handle UpdateCommand FIRST (before GetCommand which also has Key)
  if (input?.UpdateExpression && input?.Key) {
    const creator = testState.creators.get(input.Key.id);
    
    // Check ConditionExpression - if it requires the item to exist, verify it
    if (input.ConditionExpression && input.ConditionExpression.includes('attribute_exists')) {
      if (!creator) {
        // Simulate DynamoDB ConditionalCheckFailedException
        const error = new Error('The conditional request failed');
        (error as any).name = 'ConditionalCheckFailedException';
        throw error;
      }
    }
    
    if (!creator) {
      return { Attributes: undefined };
    }
    
    // Apply updates
    const updated = { ...creator };
    const values = input.ExpressionAttributeValues || {};
    
    if (values[':displayName']) updated.displayName = values[':displayName'];
    if (values[':bio']) updated.bio = values[':bio'];
    if (values[':profileImage']) updated.profileImage = values[':profileImage'];
    if (values[':coverImage']) updated.coverImage = values[':coverImage'];
    if (values[':socialLinks']) updated.socialLinks = values[':socialLinks'];
    if (values[':theme']) updated.theme = values[':theme'];
    if (values[':status']) updated.status = values[':status'];
    if (values[':updatedAt']) updated.updatedAt = values[':updatedAt'];
    
    testState.creators.set(updated.id, updated);
    testState.creatorsBySlug.set(updated.slug, updated);
    
    return { Attributes: updated };
  }
  
  // Handle QueryCommand (getCreatorBySlug, getCreatorByUserId)
  if (input?.IndexName === 'slug-index') {
    const slug = input.ExpressionAttributeValues[':slug'];
    const creator = testState.creatorsBySlug.get(slug);
    return { Items: creator ? [creator] : [] };
  }
  
  if (input?.IndexName === 'userId-index') {
    const userId = input.ExpressionAttributeValues[':userId'];
    const creator = Array.from(testState.creators.values()).find(c => c.userId === userId);
    return { Items: creator ? [creator] : [] };
  }
  
  // Handle GetCommand (getCreatorById)
  if (input?.Key?.id) {
    const creator = testState.creators.get(input.Key.id);
    return { Item: creator };
  }
  
  // Handle PutCommand (createCreator)
  if (input?.Item) {
    const creator = input.Item as Creator;
    testState.creators.set(creator.id, creator);
    testState.creatorsBySlug.set(creator.slug, creator);
    return {};
  }

  // Handle DeleteCommand (deleteCreator)
  if (input?.Key?.id && input?.ConditionExpression) {
    const creator = testState.creators.get(input.Key.id);
    if (!creator) {
      throw new Error('Creator not found');
    }
    testState.creators.delete(input.Key.id);
    testState.creatorsBySlug.delete(creator.slug);
    return {};
  }
  
  return { Items: [] };
});

// Mock AWS SDK before importing the repository
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
  GetCommand: vi.fn((params) => ({ input: params })),
  QueryCommand: vi.fn((params) => ({ input: params })),
  UpdateCommand: vi.fn((params) => ({ input: params })),
  DeleteCommand: vi.fn((params) => ({ input: params })),
}));

// Import after mocking
const {
  createCreator,
  getCreatorBySlug,
  getCreatorById,
  updateCreator,
  validateSlugUniqueness,
} = await import('./creatorRepository');

describe('Creator Repository - Property Tests', () => {
  beforeEach(() => {
    testState.creators.clear();
    testState.creatorsBySlug.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Feature: multi-creator-platform, Property 1: Creator Slug Uniqueness
   * Validates: Requirements 1.3
   * 
   * Property: For any two creators in the system, their slugs must be different.
   */
  it('should enforce slug uniqueness across all creators', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate an array of 2-10 unique usernames with valid characters
        // Must contain at least one alphanumeric character to generate valid slugs
        fc.uniqueArray(
          fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9_\s-]*[a-zA-Z0-9]$/),
          { minLength: 2, maxLength: 10 }
        ),
        async (usernames) => {
          // Reset state for this property test run
          testState.creators.clear();
          testState.creatorsBySlug.clear();
          
          const createdSlugs = new Set<string>();

          // Attempt to create creators with each username
          for (const username of usernames) {
            const input: CreateCreatorInput = {
              userId: `user-${username}`,
              username,
              displayName: `Display ${username}`,
              bio: 'Test bio',
              profileImage: 'https://example.com/profile.jpg',
              coverImage: 'https://example.com/cover.jpg',
            };

            try {
              const creator = await createCreator(input);
              createdSlugs.add(creator.slug);
            } catch (error) {
              // If creation fails due to duplicate slug, that's expected behavior
              if ((error as Error).message.includes('already taken')) {
                // This is acceptable - the system correctly rejected a duplicate
                continue;
              }
              throw error;
            }
          }

          // Property: All created slugs must be unique
          // The size of the set should equal the number of successfully created creators
          expect(createdSlugs.size).toBe(testState.creators.size);
          
          // Additional check: No two creators should have the same slug
          const slugCounts = new Map<string, number>();
          for (const creator of testState.creators.values()) {
            const count = slugCounts.get(creator.slug) || 0;
            slugCounts.set(creator.slug, count + 1);
          }
          
          for (const [slug, count] of slugCounts.entries()) {
            expect(count).toBe(1); // Each slug should appear exactly once
          }
        }
      ),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });

  /**
   * Feature: multi-creator-platform, Property 7: Profile Update Round-Trip
   * Validates: Requirements 2.1
   * 
   * Property: For any creator profile update, retrieving the profile immediately after should return the updated values.
   */
  it('should preserve all updated values in profile round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random profile updates
        fc.record({
          displayName: fc.string({ minLength: 1, maxLength: 100 }),
          bio: fc.string({ minLength: 1, maxLength: 500 }),
          profileImage: fc.webUrl(),
          coverImage: fc.webUrl(),
          socialLinks: fc.record({
            instagram: fc.option(fc.webUrl()),
            pinterest: fc.option(fc.webUrl()),
            tiktok: fc.option(fc.webUrl()),
          }),
          theme: fc.record({
            primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
            accentColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
            font: fc.constantFrom('Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'),
          }),
        }),
        async (updates) => {
          // Reset state for this property test run
          testState.creators.clear();
          testState.creatorsBySlug.clear();
          
          // Create a creator first
          const input: CreateCreatorInput = {
            userId: 'test-user-id',
            username: 'testuser',
            displayName: 'Original Name',
            bio: 'Original bio',
            profileImage: 'https://example.com/original-profile.jpg',
            coverImage: 'https://example.com/original-cover.jpg',
          };
          
          const creator = await createCreator(input);
          
          // Update the creator with random values
          const updatedCreator = await updateCreator(creator.id, updates);
          
          // Retrieve the creator again
          const retrievedCreator = await getCreatorById(creator.id);
          
          // Property: All updated fields should match the retrieved values
          expect(retrievedCreator).not.toBeNull();
          expect(retrievedCreator!.displayName).toBe(updates.displayName);
          expect(retrievedCreator!.bio).toBe(updates.bio);
          expect(retrievedCreator!.profileImage).toBe(updates.profileImage);
          expect(retrievedCreator!.coverImage).toBe(updates.coverImage);
          
          // Check social links
          if (updates.socialLinks.instagram) {
            expect(retrievedCreator!.socialLinks.instagram).toBe(updates.socialLinks.instagram);
          }
          if (updates.socialLinks.pinterest) {
            expect(retrievedCreator!.socialLinks.pinterest).toBe(updates.socialLinks.pinterest);
          }
          if (updates.socialLinks.tiktok) {
            expect(retrievedCreator!.socialLinks.tiktok).toBe(updates.socialLinks.tiktok);
          }
          
          // Check theme
          expect(retrievedCreator!.theme.primaryColor).toBe(updates.theme.primaryColor);
          expect(retrievedCreator!.theme.accentColor).toBe(updates.theme.accentColor);
          expect(retrievedCreator!.theme.font).toBe(updates.theme.font);
          
          // Also verify the update response matches
          expect(updatedCreator.displayName).toBe(updates.displayName);
          expect(updatedCreator.bio).toBe(updates.bio);
          expect(updatedCreator.profileImage).toBe(updates.profileImage);
          expect(updatedCreator.coverImage).toBe(updates.coverImage);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-creator-platform, Property 8: URL-Safe Slug Validation
   * Validates: Requirements 1.4
   * 
   * Property: For any username containing characters outside [a-z0-9-], the system must reject the slug creation.
   */
  it('should reject slugs with invalid characters', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings that may contain invalid characters
        fc.string({ minLength: 1, maxLength: 20 }),
        async (username) => {
          // Reset state for this property test run
          testState.creators.clear();
          testState.creatorsBySlug.clear();
          
          const input: CreateCreatorInput = {
            userId: 'test-user-id',
            username,
            displayName: 'Test User',
            bio: 'Test bio',
            profileImage: 'https://example.com/profile.jpg',
            coverImage: 'https://example.com/cover.jpg',
          };
          
          // Determine if the username would generate a valid slug
          // A valid slug must contain only lowercase letters, numbers, and hyphens
          // and must not start or end with a hyphen
          const generatedSlug = username
            .toLowerCase()
            .trim()
            .replace(/[\s_]+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .replace(/^-+|-+$/g, '')
            .replace(/-+/g, '-');
          
          const isValidSlug = generatedSlug.length > 0 && 
                             /^[a-z0-9-]+$/.test(generatedSlug) &&
                             !generatedSlug.startsWith('-') &&
                             !generatedSlug.endsWith('-');
          
          try {
            const creator = await createCreator(input);
            
            // If creation succeeded, the generated slug must be valid
            expect(isValidSlug).toBe(true);
            expect(creator.slug).toBe(generatedSlug);
            expect(/^[a-z0-9-]+$/.test(creator.slug)).toBe(true);
            expect(creator.slug.startsWith('-')).toBe(false);
            expect(creator.slug.endsWith('-')).toBe(false);
          } catch (error) {
            // If creation failed, it should be because the slug is invalid
            expect(isValidSlug).toBe(false);
            expect((error as Error).message).toContain('invalid');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property test: Slug uniqueness validation
   * Tests that validateSlugUniqueness correctly identifies available vs taken slugs
   */
  it('should correctly validate slug availability', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.stringMatching(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
          { minLength: 1, maxLength: 5 }
        ),
        fc.stringMatching(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
        async (existingSlugs, newSlug) => {
          // Reset state for this property test run
          testState.creators.clear();
          testState.creatorsBySlug.clear();
          
          // Create existing creators
          for (let i = 0; i < existingSlugs.length; i++) {
            const slug = existingSlugs[i];
            const creator: Creator = {
              id: `creator-${i}`,
              userId: `user-${i}`,
              slug,
              displayName: `Creator ${i}`,
              bio: 'Test bio',
              profileImage: 'https://example.com/profile.jpg',
              coverImage: 'https://example.com/cover.jpg',
              socialLinks: {},
              theme: {
                primaryColor: '#3B82F6',
                accentColor: '#10B981',
                font: 'Inter',
              },
              status: 'active',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            testState.creators.set(creator.id, creator);
            testState.creatorsBySlug.set(creator.slug, creator);
          }

          const isAvailable = await validateSlugUniqueness(newSlug);
          const shouldBeAvailable = !existingSlugs.includes(newSlug);

          // Property: validateSlugUniqueness should return true if and only if the slug is not taken
          expect(isAvailable).toBe(shouldBeAvailable);
        }
      ),
      { numRuns: 100 }
    );
  });
});
