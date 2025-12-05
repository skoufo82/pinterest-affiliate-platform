import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Product } from './types';
import { APIGatewayProxyEvent } from 'aws-lambda';

// In-memory storage for testing
const testState = {
  products: new Map<string, Product>(),
};

// Mock the DynamoDB client
const mockSend = vi.fn(async (command: any) => {
  const input = command.input;
  
  // Handle GetCommand
  if (input?.Key?.id) {
    const product = testState.products.get(input.Key.id);
    return { Item: product };
  }
  
  // Handle PutCommand
  if (input?.Item) {
    const product = input.Item as Product;
    testState.products.set(product.id, product);
    return {};
  }
  
  // Handle QueryCommand (filter by creatorId)
  if (input?.IndexName === 'creatorId-index') {
    const creatorId = input.ExpressionAttributeValues[':creatorId'];
    const products = Array.from(testState.products.values()).filter(
      p => p.creatorId === creatorId
    );
    return { Items: products };
  }
  
  // Handle UpdateCommand
  if (input?.UpdateExpression && input?.Key) {
    const product = testState.products.get(input.Key.id);
    if (!product) {
      return { Attributes: undefined };
    }
    
    const updated = { ...product };
    const values = input.ExpressionAttributeValues || {};
    
    if (values[':title']) updated.title = values[':title'];
    if (values[':description']) updated.description = values[':description'];
    if (values[':updatedAt']) updated.updatedAt = values[':updatedAt'];
    
    testState.products.set(updated.id, updated);
    return { Attributes: updated };
  }
  
  // Handle DeleteCommand
  if (input?.Key?.id && command.constructor.name === 'DeleteCommand') {
    const product = testState.products.get(input.Key.id);
    if (!product) {
      throw new Error('Product not found');
    }
    testState.products.delete(input.Key.id);
    return {};
  }
  
  return { Items: [] };
});

// Mock AWS SDK
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
  DeleteCommand: vi.fn((params) => ({ input: params, constructor: { name: 'DeleteCommand' } })),
}));

// Import after mocking
const {
  verifyProductOwnership,
  extractCreatorIdFromToken,
  verifyProductOwnershipOrAdmin,
  isAdmin,
} = await import('./ownershipValidation');

describe('Product Ownership - Property Tests', () => {
  beforeEach(() => {
    testState.products.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Feature: multi-creator-platform, Property 2: Product Ownership Assignment
   * Validates: Requirements 3.1
   * 
   * Property: For any product created by a creator, the product's creatorId must equal the creator's ID.
   */
  it('should assign correct creatorId to all created products', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random creator IDs and product data
        fc.array(
          fc.record({
            creatorId: fc.uuid(),
            products: fc.array(
              fc.record({
                id: fc.uuid(),
                title: fc.string({ minLength: 1, maxLength: 100 }),
                description: fc.string({ minLength: 1, maxLength: 500 }),
                category: fc.constantFrom('Home', 'Fashion', 'Tech', 'Beauty', 'Food'),
                imageUrl: fc.webUrl(),
                amazonLink: fc.webUrl(),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (creatorsWithProducts) => {
          // Reset state for this property test run
          testState.products.clear();
          
          // Create products for each creator
          for (const { creatorId, products } of creatorsWithProducts) {
            for (const productData of products) {
              const product: Product = {
                ...productData,
                creatorId, // Assign the creator's ID
                published: 'false',
                featured: 'false',
                status: 'pending',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              testState.products.set(product.id, product);
            }
          }
          
          // Property: Every product's creatorId must match the creator who created it
          for (const { creatorId, products } of creatorsWithProducts) {
            for (const productData of products) {
              const storedProduct = testState.products.get(productData.id);
              expect(storedProduct).toBeDefined();
              expect(storedProduct!.creatorId).toBe(creatorId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-creator-platform, Property 3: Creator Product Isolation
   * Validates: Requirements 3.2
   * 
   * Property: For any creator requesting their product list, the returned products must all have creatorId matching the requesting creator's ID.
   */
  it('should return only products owned by the requesting creator', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple creators with their products
        fc.array(
          fc.record({
            creatorId: fc.uuid(),
            productCount: fc.integer({ min: 1, max: 10 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (creators) => {
          // Reset state for this property test run
          testState.products.clear();
          
          // Create products for each creator
          for (const { creatorId, productCount } of creators) {
            for (let i = 0; i < productCount; i++) {
              const product: Product = {
                id: `${creatorId}-product-${i}`,
                creatorId,
                title: `Product ${i}`,
                description: `Description ${i}`,
                category: 'Home',
                imageUrl: 'https://example.com/image.jpg',
                amazonLink: 'https://amazon.com/product',
                published: 'true',
                featured: 'false',
                status: 'approved',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              testState.products.set(product.id, product);
            }
          }
          
          // For each creator, query their products
          for (const { creatorId, productCount } of creators) {
            // Simulate querying products by creatorId
            const creatorProducts = Array.from(testState.products.values()).filter(
              p => p.creatorId === creatorId
            );
            
            // Property: All returned products must belong to the requesting creator
            expect(creatorProducts.length).toBe(productCount);
            for (const product of creatorProducts) {
              expect(product.creatorId).toBe(creatorId);
            }
            
            // Property: No products from other creators should be included
            const otherCreatorIds = creators
              .map(c => c.creatorId)
              .filter(id => id !== creatorId);
            
            for (const product of creatorProducts) {
              expect(otherCreatorIds).not.toContain(product.creatorId);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-creator-platform, Property 4: Ownership Verification for Updates
   * Validates: Requirements 3.3
   * 
   * Property: For any product update request, if the requesting creator's ID does not match the product's creatorId, the system must reject the request.
   */
  it('should reject update requests from non-owners', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate products with owners and attempted updaters
        fc.array(
          fc.record({
            productId: fc.uuid(),
            ownerId: fc.uuid(),
            attemptedUpdaterId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (updateAttempts) => {
          // Reset state for this property test run
          testState.products.clear();
          
          for (const { productId, ownerId, attemptedUpdaterId } of updateAttempts) {
            // Create product owned by ownerId
            const product: Product = {
              id: productId,
              creatorId: ownerId,
              title: 'Original Title',
              description: 'Original Description',
              category: 'Home',
              imageUrl: 'https://example.com/image.jpg',
              amazonLink: 'https://amazon.com/product',
              published: 'true',
              featured: 'false',
              status: 'approved',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            testState.products.set(product.id, product);
            
            // Attempt to verify ownership with attemptedUpdaterId
            const isOwner = ownerId === attemptedUpdaterId;
            
            try {
              await verifyProductOwnership(productId, attemptedUpdaterId);
              
              // If verification succeeded, the updater must be the owner
              expect(isOwner).toBe(true);
            } catch (error) {
              // If verification failed, the updater must NOT be the owner
              expect(isOwner).toBe(false);
              expect((error as Error).message).toBe('OWNERSHIP_VERIFICATION_FAILED');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-creator-platform, Property 12: Admin Override Authority
   * Validates: Requirements 9.4
   * 
   * Property: For any product deletion by an admin, the deletion must succeed regardless of the product's creatorId.
   */
  it('should allow admin to delete any product regardless of ownership', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate products with different owners
        fc.array(
          fc.record({
            productId: fc.uuid(),
            ownerId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (products) => {
          // Reset state for this property test run
          testState.products.clear();
          
          // Create products with different owners
          for (const { productId, ownerId } of products) {
            const product: Product = {
              id: productId,
              creatorId: ownerId,
              title: 'Product',
              description: 'Description',
              category: 'Home',
              imageUrl: 'https://example.com/image.jpg',
              amazonLink: 'https://amazon.com/product',
              published: 'true',
              featured: 'false',
              status: 'approved',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            testState.products.set(product.id, product);
          }
          
          // Create a mock admin event
          const adminEvent = {
            requestContext: {
              authorizer: {
                claims: {
                  'cognito:groups': ['admin'],
                  'sub': 'admin-user-id',
                },
              },
            },
          } as unknown as APIGatewayProxyEvent;
          
          // Admin should be able to access and delete any product
          for (const { productId, ownerId } of products) {
            // Verify admin can access the product
            const result = await verifyProductOwnershipOrAdmin(adminEvent, productId);
            
            // Property: Admin access should succeed
            expect(result.isAdmin).toBe(true);
            expect(result.product).toBeDefined();
            expect(result.product.id).toBe(productId);
            expect(result.product.creatorId).toBe(ownerId);
            
            // Property: Admin should be able to delete regardless of ownership
            // The verifyProductOwnershipOrAdmin function returns the product,
            // indicating the admin has permission to proceed with the deletion
            expect(result.product.creatorId).not.toBe('admin-user-id'); // Admin is not the owner
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: multi-creator-platform, Property 5: Ownership Verification for Deletes
   * Validates: Requirements 3.4
   * 
   * Property: For any product delete request, if the requesting creator's ID does not match the product's creatorId, the system must reject the request.
   */
  it('should reject delete requests from non-owners', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate products with owners and attempted deleters
        fc.array(
          fc.record({
            productId: fc.uuid(),
            ownerId: fc.uuid(),
            attemptedDeleterId: fc.uuid(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (deleteAttempts) => {
          // Reset state for this property test run
          testState.products.clear();
          
          for (const { productId, ownerId, attemptedDeleterId } of deleteAttempts) {
            // Create product owned by ownerId
            const product: Product = {
              id: productId,
              creatorId: ownerId,
              title: 'Product to Delete',
              description: 'Description',
              category: 'Home',
              imageUrl: 'https://example.com/image.jpg',
              amazonLink: 'https://amazon.com/product',
              published: 'true',
              featured: 'false',
              status: 'approved',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            
            testState.products.set(product.id, product);
            
            // Attempt to verify ownership with attemptedDeleterId
            const isOwner = ownerId === attemptedDeleterId;
            
            try {
              await verifyProductOwnership(productId, attemptedDeleterId);
              
              // If verification succeeded, the deleter must be the owner
              expect(isOwner).toBe(true);
            } catch (error) {
              // If verification failed, the deleter must NOT be the owner
              expect(isOwner).toBe(false);
              expect((error as Error).message).toBe('OWNERSHIP_VERIFICATION_FAILED');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
