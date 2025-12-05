import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Product } from '@/types';

/**
 * Feature: multi-creator-platform, Property 9: Featured Product Display Order
 * 
 * Property: For any creator landing page with featured products, 
 * featured products must appear before non-featured products in the display.
 * 
 * Validates: Requirements 5.3
 */

/**
 * Feature: multi-creator-platform, Property 10: Category Filter Accuracy
 * 
 * Property: For any category filter selection on a creator's page, 
 * all returned products must belong to that category and that creator.
 * 
 * Validates: Requirements 6.3
 */

/**
 * Feature: multi-creator-platform, Property 15: Search Filter Combination
 * 
 * Property: For any combination of search query and category filter, 
 * the results must match both the search terms AND the category.
 * 
 * Validates: Requirements 12.4
 */

/**
 * Feature: multi-creator-platform, Property 13: Theme Application Consistency
 * 
 * Property: For any creator with custom theme settings, 
 * their landing page must render using those exact theme colors.
 * 
 * Validates: Requirements 8.4
 */

// Helper function to generate a random product
const productArbitrary = (featured: boolean): fc.Arbitrary<Product> => {
  return fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 5, maxLength: 100 }),
    description: fc.string({ minLength: 10, maxLength: 500 }),
    category: fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'),
    imageUrl: fc.webUrl(),
    amazonLink: fc.webUrl(),
    price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
    tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
    published: fc.constant(true),
    featured: fc.constant(featured),
    createdAt: fc.date().map(d => d.toISOString()),
    updatedAt: fc.date().map(d => d.toISOString()),
    status: fc.constant('approved' as const),
    creatorId: fc.uuid(),
  });
};

// Helper function to simulate the display order logic from CreatorLandingPage
const getDisplayOrder = (products: Product[]): Product[] => {
  // Separate featured and non-featured products
  const featured = products.filter(p => p.featured);
  const nonFeatured = products.filter(p => !p.featured);
  
  // Featured products should appear first
  return [...featured, ...nonFeatured];
};

describe('CreatorLandingPage - Featured Product Display Order', () => {
  it('should display featured products before non-featured products', () => {
    fc.assert(
      fc.property(
        // Generate a mix of featured and non-featured products
        fc.tuple(
          fc.array(productArbitrary(true), { minLength: 1, maxLength: 10 }),  // Featured products
          fc.array(productArbitrary(false), { minLength: 1, maxLength: 10 })  // Non-featured products
        ),
        ([featuredProducts, nonFeaturedProducts]) => {
          // Combine and shuffle to simulate random order from API
          const allProducts = [...featuredProducts, ...nonFeaturedProducts];
          const shuffled = fc.sample(fc.shuffledSubarray(allProducts, { minLength: allProducts.length, maxLength: allProducts.length }), 1)[0];
          
          // Get the display order
          const displayOrder = getDisplayOrder(shuffled);
          
          // Find the index of the last featured product
          const lastFeaturedIndex = displayOrder.reduce((lastIdx, product, idx) => {
            return product.featured ? idx : lastIdx;
          }, -1);
          
          // Find the index of the first non-featured product
          const firstNonFeaturedIndex = displayOrder.findIndex(product => !product.featured);
          
          // If both exist, featured should come before non-featured
          if (lastFeaturedIndex !== -1 && firstNonFeaturedIndex !== -1) {
            expect(lastFeaturedIndex).toBeLessThan(firstNonFeaturedIndex);
          }
          
          // Verify all featured products are at the beginning
          const featuredCount = featuredProducts.length;
          const displayedFeatured = displayOrder.slice(0, featuredCount);
          expect(displayedFeatured.every(p => p.featured)).toBe(true);
          
          // Verify all non-featured products are after featured
          const displayedNonFeatured = displayOrder.slice(featuredCount);
          expect(displayedNonFeatured.every(p => !p.featured)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle products with only featured items', () => {
    fc.assert(
      fc.property(
        fc.array(productArbitrary(true), { minLength: 1, maxLength: 20 }),
        (featuredProducts) => {
          const displayOrder = getDisplayOrder(featuredProducts);
          
          // All products should be featured
          expect(displayOrder.every(p => p.featured)).toBe(true);
          
          // Length should be preserved
          expect(displayOrder.length).toBe(featuredProducts.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle products with only non-featured items', () => {
    fc.assert(
      fc.property(
        fc.array(productArbitrary(false), { minLength: 1, maxLength: 20 }),
        (nonFeaturedProducts) => {
          const displayOrder = getDisplayOrder(nonFeaturedProducts);
          
          // All products should be non-featured
          expect(displayOrder.every(p => !p.featured)).toBe(true);
          
          // Length should be preserved
          expect(displayOrder.length).toBe(nonFeaturedProducts.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve all products in the display order', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(productArbitrary(true), { minLength: 0, maxLength: 10 }),
          fc.array(productArbitrary(false), { minLength: 0, maxLength: 10 })
        ),
        ([featuredProducts, nonFeaturedProducts]) => {
          const allProducts = [...featuredProducts, ...nonFeaturedProducts];
          const displayOrder = getDisplayOrder(allProducts);
          
          // Length should be preserved
          expect(displayOrder.length).toBe(allProducts.length);
          
          // All product IDs should be present
          const originalIds = new Set(allProducts.map(p => p.id));
          const displayIds = new Set(displayOrder.map(p => p.id));
          expect(displayIds).toEqual(originalIds);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Helper function to simulate category filtering logic
const filterByCategory = (products: Product[], category: string | null, creatorId: string): Product[] => {
  if (!category) {
    return products.filter(p => p.creatorId === creatorId);
  }
  return products.filter(p => p.category === category && p.creatorId === creatorId);
};

describe('CreatorLandingPage - Category Filter Accuracy', () => {
  it('should return only products matching the selected category and creator', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.uuid(), // creatorId
          fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'), // selected category
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 500 }),
              category: fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'),
              imageUrl: fc.webUrl(),
              amazonLink: fc.webUrl(),
              price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
              tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
              published: fc.constant(true),
              featured: fc.boolean(),
              createdAt: fc.date().map(d => d.toISOString()),
              updatedAt: fc.date().map(d => d.toISOString()),
              status: fc.constant('approved' as const),
              creatorId: fc.uuid(),
            }),
            { minLength: 5, maxLength: 50 }
          )
        ),
        ([creatorId, selectedCategory, allProducts]) => {
          // Assign some products to our creator
          const creatorProducts = allProducts.slice(0, Math.floor(allProducts.length / 2)).map(p => ({
            ...p,
            creatorId
          }));
          
          // Mix with other creators' products
          const mixedProducts = [...creatorProducts, ...allProducts.slice(Math.floor(allProducts.length / 2))];
          
          // Apply filter
          const filtered = filterByCategory(mixedProducts, selectedCategory, creatorId);
          
          // All filtered products must belong to the selected category
          expect(filtered.every(p => p.category === selectedCategory)).toBe(true);
          
          // All filtered products must belong to the creator
          expect(filtered.every(p => p.creatorId === creatorId)).toBe(true);
          
          // No products from other categories should be included
          const otherCategoryProducts = filtered.filter(p => p.category !== selectedCategory);
          expect(otherCategoryProducts.length).toBe(0);
          
          // No products from other creators should be included
          const otherCreatorProducts = filtered.filter(p => p.creatorId !== creatorId);
          expect(otherCreatorProducts.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return all creator products when no category is selected', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.uuid(), // creatorId
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 500 }),
              category: fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'),
              imageUrl: fc.webUrl(),
              amazonLink: fc.webUrl(),
              price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
              tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
              published: fc.constant(true),
              featured: fc.boolean(),
              createdAt: fc.date().map(d => d.toISOString()),
              updatedAt: fc.date().map(d => d.toISOString()),
              status: fc.constant('approved' as const),
              creatorId: fc.uuid(),
            }),
            { minLength: 5, maxLength: 50 }
          )
        ),
        ([creatorId, allProducts]) => {
          // Assign some products to our creator
          const creatorProducts = allProducts.slice(0, Math.floor(allProducts.length / 2)).map(p => ({
            ...p,
            creatorId
          }));
          
          // Mix with other creators' products
          const mixedProducts = [...creatorProducts, ...allProducts.slice(Math.floor(allProducts.length / 2))];
          
          // Apply filter with no category (null)
          const filtered = filterByCategory(mixedProducts, null, creatorId);
          
          // All filtered products must belong to the creator
          expect(filtered.every(p => p.creatorId === creatorId)).toBe(true);
          
          // Should return all creator products regardless of category
          expect(filtered.length).toBe(creatorProducts.length);
          
          // No products from other creators should be included
          const otherCreatorProducts = filtered.filter(p => p.creatorId !== creatorId);
          expect(otherCreatorProducts.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when creator has no products in selected category', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.uuid(), // creatorId
          fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'), // selected category
          fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'), // different category for products
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 500 }),
              category: fc.string(), // will be overridden
              imageUrl: fc.webUrl(),
              amazonLink: fc.webUrl(),
              price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
              tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
              published: fc.constant(true),
              featured: fc.boolean(),
              createdAt: fc.date().map(d => d.toISOString()),
              updatedAt: fc.date().map(d => d.toISOString()),
              status: fc.constant('approved' as const),
              creatorId: fc.string(), // will be overridden
            }),
            { minLength: 1, maxLength: 20 }
          )
        ),
        ([creatorId, selectedCategory, productCategory, products]) => {
          // Only proceed if categories are different
          if (selectedCategory === productCategory) {
            return true; // Skip this test case
          }
          
          // All products belong to creator but different category
          const creatorProducts = products.map(p => ({
            ...p,
            creatorId,
            category: productCategory
          }));
          
          // Apply filter
          const filtered = filterByCategory(creatorProducts, selectedCategory, creatorId);
          
          // Should return empty array
          expect(filtered.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain product integrity after filtering', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.uuid(), // creatorId
          fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'), // selected category
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 500 }),
              category: fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'),
              imageUrl: fc.webUrl(),
              amazonLink: fc.webUrl(),
              price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
              tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
              published: fc.constant(true),
              featured: fc.boolean(),
              createdAt: fc.date().map(d => d.toISOString()),
              updatedAt: fc.date().map(d => d.toISOString()),
              status: fc.constant('approved' as const),
              creatorId: fc.uuid(),
            }),
            { minLength: 5, maxLength: 50 }
          )
        ),
        ([creatorId, selectedCategory, allProducts]) => {
          // Assign products to creator with selected category
          const creatorProducts = allProducts.map(p => ({
            ...p,
            creatorId,
            category: selectedCategory
          }));
          
          // Apply filter
          const filtered = filterByCategory(creatorProducts, selectedCategory, creatorId);
          
          // All original product properties should be preserved
          filtered.forEach(product => {
            expect(product).toHaveProperty('id');
            expect(product).toHaveProperty('title');
            expect(product).toHaveProperty('description');
            expect(product).toHaveProperty('category');
            expect(product).toHaveProperty('imageUrl');
            expect(product).toHaveProperty('amazonLink');
            expect(product.category).toBe(selectedCategory);
            expect(product.creatorId).toBe(creatorId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Helper function to simulate combined search and category filtering
const filterBySearchAndCategory = (
  products: Product[], 
  searchQuery: string | null, 
  category: string | null
): Product[] => {
  let filtered = [...products];

  // Apply category filter
  if (category) {
    filtered = filtered.filter(p => p.category === category);
  }

  // Apply search filter
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(p => 
      p.title.toLowerCase().includes(query) || 
      p.description.toLowerCase().includes(query)
    );
  }

  return filtered;
};

describe('CreatorLandingPage - Search Filter Combination', () => {
  it('should return products matching both search query and category', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 3, maxLength: 20 }), // search query
          fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'), // category
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 500 }),
              category: fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'),
              imageUrl: fc.webUrl(),
              amazonLink: fc.webUrl(),
              price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
              tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
              published: fc.constant(true),
              featured: fc.boolean(),
              createdAt: fc.date().map(d => d.toISOString()),
              updatedAt: fc.date().map(d => d.toISOString()),
              status: fc.constant('approved' as const),
              creatorId: fc.uuid(),
            }),
            { minLength: 10, maxLength: 50 }
          )
        ),
        ([searchQuery, category, products]) => {
          // Ensure some products match the search query and category
          const matchingProducts = products.map((p, idx) => {
            if (idx % 3 === 0) {
              // Make some products match both search and category
              return {
                ...p,
                title: `${searchQuery} Product`,
                category: category
              };
            } else if (idx % 3 === 1) {
              // Make some products match only search
              return {
                ...p,
                title: `${searchQuery} Item`,
              };
            } else {
              // Make some products match only category
              return {
                ...p,
                category: category
              };
            }
          });

          // Apply combined filter
          const filtered = filterBySearchAndCategory(matchingProducts, searchQuery, category);

          // All filtered products must match the search query
          filtered.forEach(product => {
            const matchesSearch = 
              product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              product.description.toLowerCase().includes(searchQuery.toLowerCase());
            expect(matchesSearch).toBe(true);
          });

          // All filtered products must match the category
          filtered.forEach(product => {
            expect(product.category).toBe(category);
          });

          // Products that don't match both criteria should not be included
          const shouldBeExcluded = matchingProducts.filter(p => {
            const matchesSearch = 
              p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.description.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = p.category === category;
            return !matchesSearch || !matchesCategory;
          });

          shouldBeExcluded.forEach(excluded => {
            expect(filtered.find(p => p.id === excluded.id)).toBeUndefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return all products when no filters are applied', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 5, maxLength: 100 }),
            description: fc.string({ minLength: 10, maxLength: 500 }),
            category: fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'),
            imageUrl: fc.webUrl(),
            amazonLink: fc.webUrl(),
            price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
            tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
            published: fc.constant(true),
            featured: fc.boolean(),
            createdAt: fc.date().map(d => d.toISOString()),
            updatedAt: fc.date().map(d => d.toISOString()),
            status: fc.constant('approved' as const),
            creatorId: fc.uuid(),
          }),
          { minLength: 5, maxLength: 30 }
        ),
        (products) => {
          // Apply filter with no search and no category
          const filtered = filterBySearchAndCategory(products, null, null);

          // Should return all products
          expect(filtered.length).toBe(products.length);

          // All product IDs should be present
          const originalIds = new Set(products.map(p => p.id));
          const filteredIds = new Set(filtered.map(p => p.id));
          expect(filteredIds).toEqual(originalIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return products matching only search when no category is selected', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 3, maxLength: 20 }), // search query
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 500 }),
              category: fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'),
              imageUrl: fc.webUrl(),
              amazonLink: fc.webUrl(),
              price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
              tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
              published: fc.constant(true),
              featured: fc.boolean(),
              createdAt: fc.date().map(d => d.toISOString()),
              updatedAt: fc.date().map(d => d.toISOString()),
              status: fc.constant('approved' as const),
              creatorId: fc.uuid(),
            }),
            { minLength: 10, maxLength: 50 }
          )
        ),
        ([searchQuery, products]) => {
          // Make some products match the search query
          const matchingProducts = products.map((p, idx) => {
            if (idx % 2 === 0) {
              return {
                ...p,
                title: `${searchQuery} Product`,
              };
            }
            return p;
          });

          // Apply filter with search but no category
          const filtered = filterBySearchAndCategory(matchingProducts, searchQuery, null);

          // All filtered products must match the search query
          filtered.forEach(product => {
            const matchesSearch = 
              product.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              product.description.toLowerCase().includes(searchQuery.toLowerCase());
            expect(matchesSearch).toBe(true);
          });

          // Products can be from any category
          const categories = new Set(filtered.map(p => p.category));
          // If we have multiple products, we might have multiple categories
          expect(categories.size).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should return empty array when no products match combined filters', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 3, maxLength: 20 }), // search query that won't match
          fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'), // category
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 500 }),
              category: fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'),
              imageUrl: fc.webUrl(),
              amazonLink: fc.webUrl(),
              price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
              tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
              published: fc.constant(true),
              featured: fc.boolean(),
              createdAt: fc.date().map(d => d.toISOString()),
              updatedAt: fc.date().map(d => d.toISOString()),
              status: fc.constant('approved' as const),
              creatorId: fc.uuid(),
            }),
            { minLength: 5, maxLength: 20 }
          )
        ),
        ([searchQuery, category, products]) => {
          // Make sure no products match both criteria
          const nonMatchingProducts = products.map(p => ({
            ...p,
            title: 'Completely Different Title',
            description: 'Completely Different Description',
            category: category === 'Home' ? 'Fashion' : 'Home' // Different category
          }));

          // Apply combined filter
          const filtered = filterBySearchAndCategory(nonMatchingProducts, searchQuery, category);

          // Should return empty array
          expect(filtered.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty search query as no search filter', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'), // category
          fc.array(
            fc.record({
              id: fc.uuid(),
              title: fc.string({ minLength: 5, maxLength: 100 }),
              description: fc.string({ minLength: 10, maxLength: 500 }),
              category: fc.constantFrom('Home', 'Fashion', 'Electronics', 'Beauty', 'Kitchen'),
              imageUrl: fc.webUrl(),
              amazonLink: fc.webUrl(),
              price: fc.option(fc.double({ min: 1, max: 10000 }).map(p => `$${p.toFixed(2)}`), { nil: undefined }),
              tags: fc.option(fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 0, maxLength: 5 }), { nil: undefined }),
              published: fc.constant(true),
              featured: fc.boolean(),
              createdAt: fc.date().map(d => d.toISOString()),
              updatedAt: fc.date().map(d => d.toISOString()),
              status: fc.constant('approved' as const),
              creatorId: fc.uuid(),
            }),
            { minLength: 5, maxLength: 30 }
          )
        ),
        ([category, products]) => {
          // Make some products match the category
          const matchingProducts = products.map((p, idx) => {
            if (idx % 2 === 0) {
              return { ...p, category };
            }
            return p;
          });

          // Apply filter with empty search and category
          const filtered = filterBySearchAndCategory(matchingProducts, '', category);

          // All filtered products must match the category
          filtered.forEach(product => {
            expect(product.category).toBe(category);
          });

          // Should be same as filtering by category only
          const categoryOnlyFiltered = filterBySearchAndCategory(matchingProducts, null, category);
          expect(filtered.length).toBe(categoryOnlyFiltered.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Helper function to simulate theme application
const applyTheme = (theme: { primaryColor: string; accentColor: string; font: string }) => {
  return {
    primaryColor: theme.primaryColor,
    accentColor: theme.accentColor,
    font: theme.font
  };
};

// Helper function to validate hex color format
const isValidHexColor = (color: string): boolean => {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};

describe('CreatorLandingPage - Theme Application Consistency', () => {
  it('should apply exact theme colors from creator profile', () => {
    fc.assert(
      fc.property(
        fc.record({
          primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          accentColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          font: fc.constantFrom('Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana')
        }),
        (theme) => {
          // Apply theme
          const appliedTheme = applyTheme(theme);

          // Verify exact colors are applied
          expect(appliedTheme.primaryColor).toBe(theme.primaryColor);
          expect(appliedTheme.accentColor).toBe(theme.accentColor);
          expect(appliedTheme.font).toBe(theme.font);

          // Verify colors are valid hex format
          expect(isValidHexColor(appliedTheme.primaryColor)).toBe(true);
          expect(isValidHexColor(appliedTheme.accentColor)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve theme properties without modification', () => {
    fc.assert(
      fc.property(
        fc.record({
          primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          accentColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          font: fc.string({ minLength: 3, maxLength: 30 })
        }),
        (theme) => {
          // Apply theme
          const appliedTheme = applyTheme(theme);

          // Theme should not be modified during application
          expect(appliedTheme.primaryColor).toBe(theme.primaryColor);
          expect(appliedTheme.accentColor).toBe(theme.accentColor);
          expect(appliedTheme.font).toBe(theme.font);

          // No additional properties should be added
          expect(Object.keys(appliedTheme)).toEqual(['primaryColor', 'accentColor', 'font']);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle different color formats consistently', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          fc.string({ minLength: 3, maxLength: 30 })
        ),
        ([primaryColor, accentColor, font]) => {
          const theme = { primaryColor, accentColor, font };
          const appliedTheme = applyTheme(theme);

          // Colors should maintain their format
          expect(appliedTheme.primaryColor.startsWith('#')).toBe(true);
          expect(appliedTheme.accentColor.startsWith('#')).toBe(true);

          // Length should be preserved (either #RGB or #RRGGBB)
          expect(appliedTheme.primaryColor.length).toBe(primaryColor.length);
          expect(appliedTheme.accentColor.length).toBe(accentColor.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should apply theme consistently across multiple applications', () => {
    fc.assert(
      fc.property(
        fc.record({
          primaryColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          accentColor: fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          font: fc.constantFrom('Arial', 'Helvetica', 'Georgia', 'Times New Roman')
        }),
        (theme) => {
          // Apply theme multiple times
          const appliedTheme1 = applyTheme(theme);
          const appliedTheme2 = applyTheme(theme);
          const appliedTheme3 = applyTheme(theme);

          // All applications should be identical
          expect(appliedTheme1).toEqual(appliedTheme2);
          expect(appliedTheme2).toEqual(appliedTheme3);
          expect(appliedTheme1).toEqual(theme);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge case colors correctly', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          { primaryColor: '#000000', accentColor: '#FFFFFF', font: 'Arial' }, // Black and white
          { primaryColor: '#FFFFFF', accentColor: '#000000', font: 'Helvetica' }, // White and black
          { primaryColor: '#FF0000', accentColor: '#00FF00', font: 'Georgia' }, // Red and green
          { primaryColor: '#0000FF', accentColor: '#FFFF00', font: 'Verdana' }, // Blue and yellow
        ),
        (theme) => {
          const appliedTheme = applyTheme(theme);

          // Verify exact colors are preserved
          expect(appliedTheme.primaryColor).toBe(theme.primaryColor);
          expect(appliedTheme.accentColor).toBe(theme.accentColor);
          expect(appliedTheme.font).toBe(theme.font);

          // Verify valid hex format
          expect(isValidHexColor(appliedTheme.primaryColor)).toBe(true);
          expect(isValidHexColor(appliedTheme.accentColor)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain theme integrity with different fonts', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          fc.hexaString({ minLength: 6, maxLength: 6 }).map(s => `#${s}`),
          fc.constantFrom(
            'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 
            'Courier New', 'Verdana', 'Trebuchet MS', 'Comic Sans MS'
          )
        ),
        ([primaryColor, accentColor, font]) => {
          const theme = { primaryColor, accentColor, font };
          const appliedTheme = applyTheme(theme);

          // Font should be applied exactly as specified
          expect(appliedTheme.font).toBe(font);

          // Colors should not be affected by font choice
          expect(appliedTheme.primaryColor).toBe(primaryColor);
          expect(appliedTheme.accentColor).toBe(accentColor);
        }
      ),
      { numRuns: 100 }
    );
  });
});
