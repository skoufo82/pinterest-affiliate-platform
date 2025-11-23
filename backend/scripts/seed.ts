#!/usr/bin/env node
/**
 * Seed script for populating DynamoDB with sample products and categories
 * 
 * Usage:
 *   npm run seed
 * 
 * Environment variables required:
 *   - AWS_REGION: AWS region (default: us-east-1)
 *   - DYNAMODB_TABLE_NAME: DynamoDB table name
 *   - S3_BUCKET_NAME: S3 bucket for images (optional, uses placeholder URLs if not provided)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const region = process.env.AWS_REGION || 'us-east-1';
const tableName = process.env.DYNAMODB_TABLE_NAME;
const s3BucketName = process.env.S3_BUCKET_NAME;

if (!tableName) {
  console.error('Error: DYNAMODB_TABLE_NAME environment variable is required');
  process.exit(1);
}

const client = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(client);

// Sample categories
const categories = [
  {
    id: uuidv4(),
    name: 'Home & Kitchen',
    slug: 'home-kitchen',
    description: 'Curated home essentials and kitchen gadgets',
    order: 1,
  },
  {
    id: uuidv4(),
    name: 'Fashion & Beauty',
    slug: 'fashion-beauty',
    description: 'Trending fashion items and beauty products',
    order: 2,
  },
  {
    id: uuidv4(),
    name: 'Tech & Electronics',
    slug: 'tech-electronics',
    description: 'Latest gadgets and tech accessories',
    order: 3,
  },
  {
    id: uuidv4(),
    name: 'Health & Wellness',
    slug: 'health-wellness',
    description: 'Fitness equipment and wellness products',
    order: 4,
  },
  {
    id: uuidv4(),
    name: 'Books & Stationery',
    slug: 'books-stationery',
    description: 'Books, journals, and office supplies',
    order: 5,
  },
];

// Sample products for each category
const sampleProducts = [
  // Home & Kitchen
  {
    title: 'Stainless Steel French Press Coffee Maker',
    description: 'Premium 34oz French press with double-wall insulation. Makes rich, flavorful coffee in minutes. Perfect for coffee enthusiasts who appreciate a classic brewing method.',
    category: 'home-kitchen',
    imageUrl: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800',
    amazonLink: 'https://amazon.com/dp/B00MMQOZ1U?tag=youraffid-20',
    price: '$34.99',
    tags: ['coffee', 'kitchen', 'brewing'],
    published: true,
  },
  {
    title: 'Bamboo Cutting Board Set with Juice Groove',
    description: 'Eco-friendly bamboo cutting board set of 3. Durable, knife-friendly surface with juice grooves. Easy to clean and maintain.',
    category: 'home-kitchen',
    imageUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800',
    amazonLink: 'https://amazon.com/dp/B07VWQFGKL?tag=youraffid-20',
    price: '$29.99',
    tags: ['kitchen', 'bamboo', 'eco-friendly'],
    published: true,
  },
  {
    title: 'Ceramic Non-Stick Cookware Set',
    description: '10-piece ceramic non-stick cookware set. PFOA-free, dishwasher safe, and works on all stovetops including induction.',
    category: 'home-kitchen',
    imageUrl: 'https://images.unsplash.com/photo-1584990347449-39b4aa02d0f6?w=800',
    amazonLink: 'https://amazon.com/dp/B07WQFM8KL?tag=youraffid-20',
    price: '$89.99',
    tags: ['cookware', 'kitchen', 'non-stick'],
    published: true,
  },
  
  // Fashion & Beauty
  {
    title: 'Minimalist Leather Crossbody Bag',
    description: 'Genuine leather crossbody bag with adjustable strap. Perfect size for essentials. Available in multiple colors.',
    category: 'fashion-beauty',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800',
    amazonLink: 'https://amazon.com/dp/B08XYZABC1?tag=youraffid-20',
    price: '$49.99',
    tags: ['fashion', 'leather', 'bag'],
    published: true,
  },
  {
    title: 'Silk Pillowcase for Hair and Skin',
    description: '100% mulberry silk pillowcase. Reduces hair frizz and prevents sleep wrinkles. Hypoallergenic and temperature regulating.',
    category: 'fashion-beauty',
    imageUrl: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800',
    amazonLink: 'https://amazon.com/dp/B07XYZDEF2?tag=youraffid-20',
    price: '$39.99',
    tags: ['beauty', 'silk', 'skincare'],
    published: true,
  },
  {
    title: 'Rose Gold Watch with Mesh Band',
    description: 'Elegant minimalist watch with rose gold finish. Water-resistant with Japanese quartz movement. Perfect for any occasion.',
    category: 'fashion-beauty',
    imageUrl: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=800',
    amazonLink: 'https://amazon.com/dp/B08ABCXYZ3?tag=youraffid-20',
    price: '$79.99',
    tags: ['fashion', 'watch', 'accessories'],
    published: true,
  },
  
  // Tech & Electronics
  {
    title: 'Wireless Bluetooth Noise-Canceling Headphones',
    description: 'Premium over-ear headphones with active noise cancellation. 30-hour battery life, comfortable fit, and superior sound quality.',
    category: 'tech-electronics',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
    amazonLink: 'https://amazon.com/dp/B08XYZABC4?tag=youraffid-20',
    price: '$149.99',
    tags: ['tech', 'audio', 'wireless'],
    published: true,
  },
  {
    title: 'Portable Power Bank 20000mAh',
    description: 'High-capacity power bank with fast charging. Charges multiple devices simultaneously. Perfect for travel and emergencies.',
    category: 'tech-electronics',
    imageUrl: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800',
    amazonLink: 'https://amazon.com/dp/B07XYZDEF5?tag=youraffid-20',
    price: '$39.99',
    tags: ['tech', 'charging', 'portable'],
    published: true,
  },
  {
    title: 'Smart LED Light Bulbs (4-Pack)',
    description: 'WiFi-enabled smart bulbs compatible with Alexa and Google Home. 16 million colors, dimmable, and energy efficient.',
    category: 'tech-electronics',
    imageUrl: 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=800',
    amazonLink: 'https://amazon.com/dp/B08ABCXYZ6?tag=youraffid-20',
    price: '$44.99',
    tags: ['tech', 'smart-home', 'lighting'],
    published: true,
  },
  
  // Health & Wellness
  {
    title: 'Yoga Mat with Alignment Lines',
    description: 'Premium non-slip yoga mat with alignment guides. Extra thick for comfort, eco-friendly materials. Includes carrying strap.',
    category: 'health-wellness',
    imageUrl: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800',
    amazonLink: 'https://amazon.com/dp/B08XYZABC7?tag=youraffid-20',
    price: '$34.99',
    tags: ['fitness', 'yoga', 'wellness'],
    published: true,
  },
  {
    title: 'Resistance Bands Set with Handles',
    description: '5-level resistance band set for home workouts. Includes door anchor, handles, and ankle straps. Perfect for strength training.',
    category: 'health-wellness',
    imageUrl: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=800',
    amazonLink: 'https://amazon.com/dp/B07XYZDEF8?tag=youraffid-20',
    price: '$29.99',
    tags: ['fitness', 'resistance', 'home-gym'],
    published: true,
  },
  {
    title: 'Stainless Steel Water Bottle with Straw',
    description: 'Insulated 32oz water bottle keeps drinks cold for 24 hours. BPA-free, leak-proof, and dishwasher safe.',
    category: 'health-wellness',
    imageUrl: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=800',
    amazonLink: 'https://amazon.com/dp/B08ABCXYZ9?tag=youraffid-20',
    price: '$24.99',
    tags: ['wellness', 'hydration', 'eco-friendly'],
    published: true,
  },
  
  // Books & Stationery
  {
    title: 'Leather Journal with Refillable Pages',
    description: 'Handcrafted leather journal with 200 lined pages. Refillable design, pen holder, and bookmark ribbon. Perfect for writing and sketching.',
    category: 'books-stationery',
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=800',
    amazonLink: 'https://amazon.com/dp/B08XYZABC0?tag=youraffid-20',
    price: '$34.99',
    tags: ['stationery', 'journal', 'writing'],
    published: true,
  },
  {
    title: 'Gel Pen Set - 24 Vibrant Colors',
    description: 'Premium gel pen set with smooth ink flow. Perfect for bullet journaling, note-taking, and adult coloring books.',
    category: 'books-stationery',
    imageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800',
    amazonLink: 'https://amazon.com/dp/B07XYZDEFA?tag=youraffid-20',
    price: '$19.99',
    tags: ['stationery', 'pens', 'art'],
    published: true,
  },
  {
    title: 'Desk Organizer with Wireless Charging Pad',
    description: 'Bamboo desk organizer with built-in wireless charger. Multiple compartments for pens, phone, and accessories.',
    category: 'books-stationery',
    imageUrl: 'https://images.unsplash.com/photo-1611269154421-4e27233ac5c7?w=800',
    amazonLink: 'https://amazon.com/dp/B08ABCXYZB?tag=youraffid-20',
    price: '$49.99',
    tags: ['stationery', 'organization', 'tech'],
    published: true,
  },
];

async function seedCategories() {
  console.log('Seeding categories...');
  
  for (const category of categories) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: category,
        })
      );
      console.log(`✓ Created category: ${category.name}`);
    } catch (error) {
      console.error(`✗ Failed to create category ${category.name}:`, error);
    }
  }
}

async function seedProducts() {
  console.log('\nSeeding products...');
  
  const now = new Date().toISOString();
  
  for (const productData of sampleProducts) {
    const product = {
      id: uuidv4(),
      ...productData,
      published: productData.published ? 'true' : 'false', // Convert boolean to string for GSI
      createdAt: now,
      updatedAt: now,
    };
    
    try {
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: product,
        })
      );
      console.log(`✓ Created product: ${product.title}`);
    } catch (error) {
      console.error(`✗ Failed to create product ${product.title}:`, error);
    }
  }
}

async function main() {
  console.log('Starting seed process...');
  console.log(`Region: ${region}`);
  console.log(`Table: ${tableName}`);
  console.log('');
  
  try {
    await seedCategories();
    await seedProducts();
    
    console.log('\n✓ Seed process completed successfully!');
    console.log(`\nSeeded ${categories.length} categories and ${sampleProducts.length} products.`);
  } catch (error) {
    console.error('\n✗ Seed process failed:', error);
    process.exit(1);
  }
}

main();
