# API Documentation

Complete reference for the Pinterest Affiliate Platform REST API.

## Base URL

```
https://<api-id>.execute-api.<region>.amazonaws.com/prod
```

Replace `<api-id>` and `<region>` with your API Gateway deployment values.

## Authentication

The API uses AWS Cognito for authentication with JWT tokens. Different endpoint groups have different authentication requirements:

- **Public endpoints**: No authentication required
- **Creator endpoints**: Require valid JWT token with `creator` role
- **Admin endpoints**: Require valid JWT token with `admin` role

**Authentication Header Format:**

```
Authorization: Bearer <jwt-token>
```

**Roles:**
- `admin`: Full platform access, can manage all creators and products
- `creator`: Can manage own profile and products only
- `viewer`: Read-only access (default for unauthenticated users)

## Response Format

All API responses follow a consistent JSON format:

**Success Response:**
```json
{
  "data": { ... },
  "success": true
}
```

**Error Response:**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... },
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "abc-123-xyz"
  }
}
```

## HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate slug)
- `413 Payload Too Large` - Request body too large
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error

---

## Public Endpoints

### Get All Products

Retrieve a list of published products with optional filtering.

**Endpoint:** `GET /api/products`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | string | No | Filter by category slug (e.g., "home-kitchen") |
| limit | number | No | Number of products to return (default: 20, max: 100) |
| offset | number | No | Number of products to skip for pagination (default: 0) |

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/products?category=tech-electronics&limit=10"
```

**Example Response:**

```json
{
  "products": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Wireless Bluetooth Headphones",
      "description": "Premium noise-canceling headphones with 30-hour battery life",
      "category": "tech-electronics",
      "imageUrl": "https://images.example.com/headphones.jpg",
      "amazonLink": "https://amazon.com/dp/B08XYZ?tag=affiliate-20",
      "price": "$149.99",
      "tags": ["tech", "audio", "wireless"],
      "published": true,
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 45,
  "hasMore": true
}
```

**Notes:**
- Only returns products where `published: true`
- Results are sorted by `createdAt` in descending order (newest first)
- Use `offset` and `limit` for pagination

---

### Get Single Product

Retrieve details for a specific product by ID.

**Endpoint:** `GET /api/products/:id`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Product ID |

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/products/550e8400-e29b-41d4-a716-446655440000"
```

**Example Response:**

```json
{
  "product": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Wireless Bluetooth Headphones",
    "description": "Premium noise-canceling headphones with 30-hour battery life. Features active noise cancellation, comfortable over-ear design, and superior sound quality.",
    "category": "tech-electronics",
    "imageUrl": "https://images.example.com/headphones.jpg",
    "amazonLink": "https://amazon.com/dp/B08XYZ?tag=affiliate-20",
    "price": "$149.99",
    "tags": ["tech", "audio", "wireless"],
    "published": true,
    "createdAt": "2025-01-15T10:30:00Z",
    "updatedAt": "2025-01-15T10:30:00Z"
  }
}
```

**Error Responses:**

- `404 Not Found` - Product does not exist or is not published

---

### Get All Categories

Retrieve a list of all product categories.

**Endpoint:** `GET /api/categories`

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/categories"
```

**Example Response:**

```json
{
  "categories": [
    {
      "id": "cat-001",
      "name": "Home & Kitchen",
      "slug": "home-kitchen",
      "description": "Curated home essentials and kitchen gadgets",
      "imageUrl": "https://images.example.com/categories/home-kitchen.jpg",
      "order": 1
    },
    {
      "id": "cat-002",
      "name": "Tech & Electronics",
      "slug": "tech-electronics",
      "description": "Latest gadgets and tech accessories",
      "imageUrl": "https://images.example.com/categories/tech.jpg",
      "order": 2
    }
  ]
}
```

**Notes:**
- Categories are sorted by the `order` field
- The `slug` field is used for filtering products by category

---

## Creator Endpoints

### Get Creator by Slug

Retrieve a creator's public profile and theme settings.

**Endpoint:** `GET /api/creators/:slug`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| slug | string | Yes | Creator's unique URL slug |

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/creators/sarah-home-decor"
```

**Example Response:**

```json
{
  "creator": {
    "id": "creator-123",
    "slug": "sarah-home-decor",
    "displayName": "Sarah's Home Finds",
    "bio": "Curating beautiful and functional home decor pieces",
    "profileImage": "https://s3.amazonaws.com/bucket/profiles/sarah.jpg",
    "coverImage": "https://s3.amazonaws.com/bucket/covers/sarah-cover.jpg",
    "socialLinks": {
      "instagram": "https://instagram.com/sarahhomefinds",
      "pinterest": "https://pinterest.com/sarahhomefinds"
    },
    "theme": {
      "primaryColor": "#2C5F2D",
      "accentColor": "#97BC62",
      "font": "Inter"
    },
    "status": "active",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

**Error Responses:**

- `404 Not Found` - Creator does not exist or is disabled

---

### Get Creator's Products

Retrieve all approved products for a specific creator.

**Endpoint:** `GET /api/creators/:slug/products`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| slug | string | Yes | Creator's unique URL slug |

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| category | string | No | Filter by category |
| search | string | No | Search in title and description |
| sort | string | No | Sort order: `newest`, `price-asc`, `price-desc` |
| limit | number | No | Number of products (default: 20, max: 100) |
| offset | number | No | Pagination offset (default: 0) |

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/creators/sarah-home-decor/products?category=home-kitchen&sort=newest&limit=10"
```

**Example Response:**

```json
{
  "products": [
    {
      "id": "product-456",
      "creatorId": "creator-123",
      "title": "Ceramic Vase Set",
      "description": "Beautiful handcrafted ceramic vases",
      "category": "home-kitchen",
      "imageUrl": "https://s3.amazonaws.com/bucket/products/vase.jpg",
      "amazonLink": "https://amazon.com/dp/B08XYZ?tag=affiliate-20",
      "price": 49.99,
      "featured": true,
      "status": "approved",
      "createdAt": "2025-01-15T10:30:00Z",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 45,
  "hasMore": true
}
```

**Notes:**
- Only returns products with `status: "approved"`
- Featured products appear first when no sort is specified

---

### Get Creator's Featured Products

Retrieve featured products for a creator.

**Endpoint:** `GET /api/creators/:slug/featured`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| slug | string | Yes | Creator's unique URL slug |

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/creators/sarah-home-decor/featured"
```

**Example Response:**

```json
{
  "products": [
    {
      "id": "product-456",
      "title": "Ceramic Vase Set",
      "featured": true,
      "imageUrl": "https://s3.amazonaws.com/bucket/products/vase.jpg",
      "price": 49.99
    }
  ]
}
```

---

### Get Creator Profile (Authenticated)

Retrieve the authenticated creator's own profile.

**Endpoint:** `GET /api/creator/profile`

**Authentication:** Required (Creator role)

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/creator/profile" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "creator": {
    "id": "creator-123",
    "userId": "cognito-user-id",
    "slug": "sarah-home-decor",
    "displayName": "Sarah's Home Finds",
    "bio": "Curating beautiful and functional home decor pieces",
    "profileImage": "https://s3.amazonaws.com/bucket/profiles/sarah.jpg",
    "coverImage": "https://s3.amazonaws.com/bucket/covers/sarah-cover.jpg",
    "socialLinks": {
      "instagram": "https://instagram.com/sarahhomefinds",
      "pinterest": "https://pinterest.com/sarahhomefinds",
      "tiktok": "https://tiktok.com/@sarahhomefinds"
    },
    "theme": {
      "primaryColor": "#2C5F2D",
      "accentColor": "#97BC62",
      "font": "Inter"
    },
    "status": "active",
    "createdAt": "2025-01-15T10:00:00Z",
    "updatedAt": "2025-01-15T10:00:00Z"
  }
}
```

**Error Responses:**

- `401 Unauthorized` - Invalid or missing JWT token
- `403 Forbidden` - User is not a creator

---

### Update Creator Profile

Update the authenticated creator's profile.

**Endpoint:** `PUT /api/creator/profile`

**Authentication:** Required (Creator role)

**Request Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| displayName | string | No | Public display name (max 100 chars) |
| bio | string | No | Creator bio (max 500 chars) |
| profileImage | string | No | S3 URL of profile image |
| coverImage | string | No | S3 URL of cover image |
| socialLinks | object | No | Social media links |
| socialLinks.instagram | string | No | Instagram URL |
| socialLinks.pinterest | string | No | Pinterest URL |
| socialLinks.tiktok | string | No | TikTok URL |
| theme | object | No | Theme customization |
| theme.primaryColor | string | No | Hex color code |
| theme.accentColor | string | No | Hex color code |
| theme.font | string | No | Font family name |

**Example Request:**

```bash
curl -X PUT "https://api.example.com/prod/api/creator/profile" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "displayName": "Sarah'\''s Home Finds",
    "bio": "Curating beautiful home decor",
    "theme": {
      "primaryColor": "#2C5F2D",
      "accentColor": "#97BC62"
    }
  }'
```

**Example Response:**

```json
{
  "creator": {
    "id": "creator-123",
    "displayName": "Sarah's Home Finds",
    "bio": "Curating beautiful home decor",
    "theme": {
      "primaryColor": "#2C5F2D",
      "accentColor": "#97BC62",
      "font": "Inter"
    },
    "updatedAt": "2025-01-15T11:00:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Invalid or missing JWT token

**Validation Rules:**
- `displayName`: 1-100 characters
- `bio`: 0-500 characters
- Color codes must be valid hex format (#RRGGBB)
- Social links must be valid HTTPS URLs

---

### Get Creator's Own Products

Retrieve all products owned by the authenticated creator (all statuses).

**Endpoint:** `GET /api/creator/products`

**Authentication:** Required (Creator role)

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status: `pending`, `approved`, `rejected` |

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/creator/products?status=pending" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "products": [
    {
      "id": "product-789",
      "creatorId": "creator-123",
      "title": "Modern Table Lamp",
      "description": "Minimalist design table lamp",
      "category": "home-kitchen",
      "imageUrl": "https://s3.amazonaws.com/bucket/products/lamp.jpg",
      "amazonLink": "https://amazon.com/dp/B08ABC?tag=affiliate-20",
      "price": 79.99,
      "featured": false,
      "status": "pending",
      "createdAt": "2025-01-16T09:00:00Z",
      "updatedAt": "2025-01-16T09:00:00Z"
    }
  ]
}
```

**Notes:**
- Returns products in all statuses (pending, approved, rejected)
- Only returns products owned by the authenticated creator

---

### Create Product (Creator)

Create a new product as a creator.

**Endpoint:** `POST /api/creator/products`

**Authentication:** Required (Creator role)

**Request Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Product title (max 200 characters) |
| description | string | Yes | Product description (max 2000 characters) |
| category | string | Yes | Category slug |
| imageUrl | string | Yes | S3 URL of product image |
| amazonLink | string | Yes | Amazon affiliate link |
| price | number | No | Price in dollars |
| featured | boolean | No | Mark as featured (default: false) |

**Example Request:**

```bash
curl -X POST "https://api.example.com/prod/api/creator/products" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Bamboo Cutting Board",
    "description": "Eco-friendly bamboo cutting board",
    "category": "home-kitchen",
    "imageUrl": "https://s3.amazonaws.com/bucket/products/board.jpg",
    "amazonLink": "https://amazon.com/dp/B08DEF?tag=affiliate-20",
    "price": 29.99,
    "featured": true
  }'
```

**Example Response:**

```json
{
  "product": {
    "id": "product-890",
    "creatorId": "creator-123",
    "title": "Bamboo Cutting Board",
    "description": "Eco-friendly bamboo cutting board",
    "category": "home-kitchen",
    "imageUrl": "https://s3.amazonaws.com/bucket/products/board.jpg",
    "amazonLink": "https://amazon.com/dp/B08DEF?tag=affiliate-20",
    "price": 29.99,
    "featured": true,
    "status": "pending",
    "createdAt": "2025-01-16T10:00:00Z",
    "updatedAt": "2025-01-16T10:00:00Z"
  }
}
```

**Notes:**
- New products are automatically set to `status: "pending"` for admin review
- `creatorId` is automatically assigned from the JWT token
- Product will not appear on public landing page until approved

---

### Update Product (Creator)

Update an existing product owned by the authenticated creator.

**Endpoint:** `PUT /api/creator/products/:id`

**Authentication:** Required (Creator role)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Product ID |

**Request Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

Same fields as Create Product, all optional. Only include fields to update.

**Example Request:**

```bash
curl -X PUT "https://api.example.com/prod/api/creator/products/product-890" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 24.99,
    "featured": false
  }'
```

**Example Response:**

```json
{
  "product": {
    "id": "product-890",
    "price": 24.99,
    "featured": false,
    "updatedAt": "2025-01-16T11:00:00Z"
  }
}
```

**Error Responses:**

- `403 Forbidden` - Product is not owned by the authenticated creator
- `404 Not Found` - Product does not exist

**Notes:**
- Ownership is verified before allowing updates
- Cannot modify `creatorId` or `status` fields

---

### Delete Product (Creator)

Delete a product owned by the authenticated creator.

**Endpoint:** `DELETE /api/creator/products/:id`

**Authentication:** Required (Creator role)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Product ID |

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Example Request:**

```bash
curl -X DELETE "https://api.example.com/prod/api/creator/products/product-890" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

**Error Responses:**

- `403 Forbidden` - Product is not owned by the authenticated creator
- `404 Not Found` - Product does not exist

---

### Get Creator Analytics

Retrieve analytics for the authenticated creator's storefront.

**Endpoint:** `GET /api/creator/analytics`

**Authentication:** Required (Creator role)

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| startDate | string | No | Start date (ISO 8601, default: 30 days ago) |
| endDate | string | No | End date (ISO 8601, default: today) |

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/creator/analytics?startDate=2025-01-01&endDate=2025-01-31" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "analytics": {
    "summary": {
      "pageViews": 1250,
      "productViews": 3420,
      "affiliateClicks": 156,
      "clickThroughRate": 4.56
    },
    "topProducts": [
      {
        "productId": "product-456",
        "title": "Ceramic Vase Set",
        "views": 450,
        "clicks": 45,
        "clickThroughRate": 10.0
      },
      {
        "productId": "product-789",
        "title": "Modern Table Lamp",
        "views": 380,
        "clicks": 32,
        "clickThroughRate": 8.42
      }
    ],
    "dailyMetrics": [
      {
        "date": "2025-01-15",
        "pageViews": 45,
        "productViews": 120,
        "affiliateClicks": 8
      }
    ]
  }
}
```

**Notes:**
- Analytics data is aggregated daily
- Click-through rate is calculated as (clicks / views) * 100
- Top products are sorted by total clicks

---

## Admin Endpoints

### Create Product

Create a new product in the catalog.

**Endpoint:** `POST /api/admin/products`

**Request Headers:**

```
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Product title (max 200 characters) |
| description | string | Yes | Product description (max 2000 characters) |
| category | string | Yes | Category slug |
| imageUrl | string | Yes | S3 URL of product image |
| amazonLink | string | Yes | Amazon affiliate link |
| price | string | No | Display price (e.g., "$29.99") |
| tags | string[] | No | Array of tags for filtering |
| published | boolean | Yes | Visibility status |

**Example Request:**

```bash
curl -X POST "https://api.example.com/prod/api/admin/products" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Stainless Steel Water Bottle",
    "description": "Insulated 32oz water bottle keeps drinks cold for 24 hours",
    "category": "health-wellness",
    "imageUrl": "https://images.example.com/water-bottle.jpg",
    "amazonLink": "https://amazon.com/dp/B08ABC?tag=affiliate-20",
    "price": "$24.99",
    "tags": ["wellness", "hydration"],
    "published": true
  }'
```

**Example Response:**

```json
{
  "product": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Stainless Steel Water Bottle",
    "description": "Insulated 32oz water bottle keeps drinks cold for 24 hours",
    "category": "health-wellness",
    "imageUrl": "https://images.example.com/water-bottle.jpg",
    "amazonLink": "https://amazon.com/dp/B08ABC?tag=affiliate-20",
    "price": "$24.99",
    "tags": ["wellness", "hydration"],
    "published": true,
    "createdAt": "2025-01-15T11:00:00Z",
    "updatedAt": "2025-01-15T11:00:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request` - Invalid input data (missing required fields, invalid format)

**Validation Rules:**
- `title`: 1-200 characters
- `description`: 1-2000 characters
- `category`: Must be a valid category slug
- `imageUrl`: Must be a valid HTTPS URL
- `amazonLink`: Must be a valid HTTPS URL

---

### Update Product

Update an existing product.

**Endpoint:** `PUT /api/admin/products/:id`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Product ID |

**Request Body:**

Same fields as Create Product, but all fields are optional. Only include fields you want to update.

**Example Request:**

```bash
curl -X PUT "https://api.example.com/prod/api/admin/products/660e8400-e29b-41d4-a716-446655440001" \
  -H "Content-Type: application/json" \
  -d '{
    "price": "$19.99",
    "published": false
  }'
```

**Example Response:**

```json
{
  "product": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "Stainless Steel Water Bottle",
    "description": "Insulated 32oz water bottle keeps drinks cold for 24 hours",
    "category": "health-wellness",
    "imageUrl": "https://images.example.com/water-bottle.jpg",
    "amazonLink": "https://amazon.com/dp/B08ABC?tag=affiliate-20",
    "price": "$19.99",
    "tags": ["wellness", "hydration"],
    "published": false,
    "createdAt": "2025-01-15T11:00:00Z",
    "updatedAt": "2025-01-15T11:30:00Z"
  }
}
```

**Error Responses:**

- `404 Not Found` - Product does not exist
- `400 Bad Request` - Invalid input data

**Notes:**
- The `updatedAt` timestamp is automatically updated
- The `id` and `createdAt` fields cannot be modified

---

### Delete Product

Delete a product from the catalog.

**Endpoint:** `DELETE /api/admin/products/:id`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Product ID |

**Example Request:**

```bash
curl -X DELETE "https://api.example.com/prod/api/admin/products/660e8400-e29b-41d4-a716-446655440001"
```

**Example Response:**

```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

**Error Responses:**

- `404 Not Found` - Product does not exist

**Notes:**
- This is a hard delete operation (product is permanently removed)
- Consider setting `published: false` instead for soft deletion

---

### Upload Image

Generate a presigned URL for uploading product images to S3.

**Endpoint:** `POST /api/admin/upload-image`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| fileName | string | Yes | Original file name |
| fileType | string | Yes | MIME type (e.g., "image/jpeg") |

**Example Request:**

```bash
curl -X POST "https://api.example.com/prod/api/admin/upload-image" \
  -H "Content-Type: application/json" \
  -d '{
    "fileName": "product-image.jpg",
    "fileType": "image/jpeg"
  }'
```

**Example Response:**

```json
{
  "uploadUrl": "https://s3.amazonaws.com/bucket/path?presigned-params",
  "imageUrl": "https://s3.amazonaws.com/bucket/path/product-image.jpg",
  "expiresAt": 1705318200
}
```

**Usage Flow:**

1. Call this endpoint to get a presigned URL
2. Upload the image file directly to S3 using the `uploadUrl` (PUT request)
3. Use the `imageUrl` when creating/updating products

**Example Upload to S3:**

```bash
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: image/jpeg" \
  --data-binary @product-image.jpg
```

**Error Responses:**

- `400 Bad Request` - Invalid file type or file name

**Validation Rules:**
- Allowed file types: `image/jpeg`, `image/png`, `image/webp`
- Maximum file size: 5MB (enforced client-side)
- Presigned URL expires after 5 minutes

---

### Trigger Price Sync

Manually trigger synchronization of product prices with Amazon PA-API.

**Endpoint:** `POST /api/admin/sync-prices`

**Authentication:** Required (Cognito JWT token)

**Authorization:** Admin or Editor role required

**Request Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:** None required

**Example Request:**

```bash
curl -X POST "https://api.example.com/prod/api/admin/sync-prices" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json"
```

**Example Response:**

```json
{
  "message": "Price sync triggered successfully",
  "executionId": "manual-1701234567890-abc123",
  "status": "running",
  "triggeredBy": "admin-username",
  "triggeredAt": "2024-12-02T10:30:00.000Z",
  "note": "Check CloudWatch logs for execution details"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| message | string | Success message |
| executionId | string | Unique identifier for this sync execution |
| status | string | Current status (always "running" on trigger) |
| triggeredBy | string | Username of the admin who triggered the sync |
| triggeredAt | string | ISO timestamp when sync was triggered |
| note | string | Instructions for monitoring the sync |

**Error Responses:**

- `401 Unauthorized` - Invalid or expired JWT token
- `403 Forbidden` - User lacks admin/editor privileges
- `500 Internal Server Error` - Failed to invoke sync Lambda

**Notes:**
- The sync runs asynchronously in the background
- Use the `executionId` to track the sync in CloudWatch logs
- Check `/aws/lambda/pinterest-affiliate-syncAmazonPrices` log group
- Avoid triggering multiple syncs simultaneously
- Respect Amazon PA-API rate limits (1 request/second)
- Scheduled sync runs daily at 2 AM UTC automatically

**Monitoring:**
- View real-time metrics in the CloudWatch Dashboard: "PinterestAffiliate-PriceSync"
- Search CloudWatch logs using the execution ID
- Check CloudWatch alarms for high failure rates or authentication errors

**Use Cases:**
- After bulk product updates requiring immediate price refresh
- Testing PA-API integration
- Emergency price updates outside scheduled time
- Verifying new PA-API credentials

**Related Documentation:**
- [Manual Price Sync Guide](MANUAL_PRICE_SYNC.md)
- [Price Sync Infrastructure](PRICE_SYNC_INFRASTRUCTURE.md)
- [Price Sync Monitoring](PRICE_SYNC_MONITORING.md)

---

### Creator Management (Admin)

#### List All Creators

Retrieve all creators on the platform.

**Endpoint:** `GET /api/admin/creators`

**Authentication:** Required (Admin role)

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/admin/creators" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "creators": [
    {
      "id": "creator-123",
      "slug": "sarah-home-decor",
      "displayName": "Sarah's Home Finds",
      "email": "sarah@example.com",
      "status": "active",
      "productCount": 45,
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ]
}
```

---

#### Update Creator Status

Enable or disable a creator account.

**Endpoint:** `PUT /api/admin/creators/:id/status`

**Authentication:** Required (Admin role)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Creator ID |

**Request Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Yes | `active` or `disabled` |

**Example Request:**

```bash
curl -X PUT "https://api.example.com/prod/api/admin/creators/creator-123/status" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "disabled"
  }'
```

**Example Response:**

```json
{
  "creator": {
    "id": "creator-123",
    "status": "disabled",
    "updatedAt": "2025-01-16T12:00:00Z"
  }
}
```

**Notes:**
- Disabling a creator hides their landing page and prevents login
- Creator receives email notification of status change

---

### Product Moderation (Admin)

#### Get Pending Products

Retrieve all products awaiting approval.

**Endpoint:** `GET /api/admin/products/pending`

**Authentication:** Required (Admin role)

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/admin/products/pending" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "products": [
    {
      "id": "product-789",
      "creatorId": "creator-123",
      "creatorName": "Sarah's Home Finds",
      "title": "Modern Table Lamp",
      "description": "Minimalist design table lamp",
      "category": "home-kitchen",
      "imageUrl": "https://s3.amazonaws.com/bucket/products/lamp.jpg",
      "amazonLink": "https://amazon.com/dp/B08ABC?tag=affiliate-20",
      "price": 79.99,
      "status": "pending",
      "createdAt": "2025-01-16T09:00:00Z"
    }
  ]
}
```

---

#### Approve Product

Approve a pending product for public display.

**Endpoint:** `PUT /api/admin/products/:id/approve`

**Authentication:** Required (Admin role)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Product ID |

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Example Request:**

```bash
curl -X PUT "https://api.example.com/prod/api/admin/products/product-789/approve" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "product": {
    "id": "product-789",
    "status": "approved",
    "updatedAt": "2025-01-16T12:30:00Z"
  }
}
```

**Notes:**
- Product becomes visible on creator's public landing page
- Creator receives email notification of approval

---

#### Reject Product

Reject a pending product with a reason.

**Endpoint:** `PUT /api/admin/products/:id/reject`

**Authentication:** Required (Admin role)

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string (UUID) | Yes | Product ID |

**Request Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| reason | string | Yes | Rejection reason (max 500 chars) |

**Example Request:**

```bash
curl -X PUT "https://api.example.com/prod/api/admin/products/product-789/reject" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Product image quality is too low. Please upload a higher resolution image."
  }'
```

**Example Response:**

```json
{
  "product": {
    "id": "product-789",
    "status": "rejected",
    "rejectionReason": "Product image quality is too low. Please upload a higher resolution image.",
    "updatedAt": "2025-01-16T12:35:00Z"
  }
}
```

**Notes:**
- Product remains hidden from public landing page
- Creator receives email notification with rejection reason
- Creator can edit and resubmit the product

---

#### Get All Products (Admin)

Retrieve all products across all creators with filtering.

**Endpoint:** `GET /api/admin/products`

**Authentication:** Required (Admin role)

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| creatorId | string | No | Filter by creator ID |
| status | string | No | Filter by status: `pending`, `approved`, `rejected` |
| limit | number | No | Number of products (default: 20, max: 100) |
| offset | number | No | Pagination offset (default: 0) |

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/admin/products?status=approved&limit=50" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "products": [
    {
      "id": "product-456",
      "creatorId": "creator-123",
      "creatorName": "Sarah's Home Finds",
      "title": "Ceramic Vase Set",
      "status": "approved",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  ],
  "total": 150,
  "hasMore": true
}
```

---

### User Management

#### List Users

Retrieve all users in the Cognito user pool.

**Endpoint:** `GET /api/admin/users`

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Example Request:**

```bash
curl -X GET "https://api.example.com/prod/api/admin/users" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "users": [
    {
      "username": "admin",
      "email": "admin@example.com",
      "givenName": "John",
      "familyName": "Doe",
      "enabled": true,
      "status": "CONFIRMED",
      "created": "2025-01-15T10:00:00Z",
      "modified": "2025-01-15T10:00:00Z",
      "groups": ["Admins"]
    }
  ]
}
```

---

#### Create User

Create a new admin user in Cognito.

**Endpoint:** `POST /api/admin/users`

**Request Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| username | string | Yes | Username (alphanumeric, 3-20 characters) |
| email | string | Yes | Valid email address |
| password | string | Yes | Password (min 8 chars, uppercase, lowercase, number) |
| givenName | string | No | First name |
| familyName | string | No | Last name |
| sendEmail | boolean | No | Send welcome email (default: false) |

**Example Request:**

```bash
curl -X POST "https://api.example.com/prod/api/admin/users" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "newadmin",
    "email": "newadmin@example.com",
    "password": "SecurePass123",
    "givenName": "Jane",
    "familyName": "Smith",
    "sendEmail": false
  }'
```

**Example Response:**

```json
{
  "success": true,
  "message": "User created successfully",
  "username": "newadmin"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid input or user already exists
- `401 Unauthorized` - Missing or invalid JWT token

---

#### Reset User Password

Reset a user's password (admin operation).

**Endpoint:** `POST /api/admin/users/:username/reset-password`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| username | string | Yes | Username of the user |

**Request Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| password | string | Yes | New password |
| temporary | boolean | No | Require password change on next login (default: false) |

**Example Request:**

```bash
curl -X POST "https://api.example.com/prod/api/admin/users/newadmin/reset-password" \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "NewSecurePass123",
    "temporary": false
  }'
```

**Example Response:**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Error Responses:**

- `404 Not Found` - User does not exist
- `400 Bad Request` - Invalid password format
- `401 Unauthorized` - Missing or invalid JWT token

---

#### Delete User

Delete a user from Cognito.

**Endpoint:** `DELETE /api/admin/users/:username`

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| username | string | Yes | Username of the user to delete |

**Request Headers:**

```
Authorization: Bearer <jwt-token>
```

**Example Request:**

```bash
curl -X DELETE "https://api.example.com/prod/api/admin/users/newadmin" \
  -H "Authorization: Bearer <jwt-token>"
```

**Example Response:**

```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Error Responses:**

- `404 Not Found` - User does not exist
- `401 Unauthorized` - Missing or invalid JWT token

**Notes:**
- This is a permanent deletion
- Cannot delete your own user account
- User must not be the last admin

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `INTERNAL_ERROR` | Internal server error |
| `INVALID_FILE_TYPE` | Unsupported file type for upload |
| `MISSING_REQUIRED_FIELD` | Required field is missing |
| `INVALID_FORMAT` | Field format is invalid |
| `UNAUTHORIZED` | Authentication required or invalid token |
| `FORBIDDEN` | Insufficient permissions for this operation |
| `DUPLICATE_SLUG` | Creator slug already exists |
| `OWNERSHIP_ERROR` | Product is not owned by the requesting creator |
| `INVALID_STATUS` | Invalid product or creator status |
| `RATE_LIMIT_EXCEEDED` | Too many requests, please retry later |

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Public endpoints**: 100 requests per minute per IP
- **Creator endpoints**: 1000 requests per minute per authenticated user
- **Admin endpoints**: 10000 requests per minute per authenticated user

When rate limit is exceeded, the API returns:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 60
  }
}
```

**Response Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the limit resets

---

## CORS

The API supports Cross-Origin Resource Sharing (CORS) for the following origins:

- `http://localhost:5173` (local development)
- Your Amplify domain (production)

**Allowed Methods:** GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers:** Content-Type, Authorization

---

## Pagination

For endpoints that return lists (e.g., `/api/products`), use the `limit` and `offset` parameters:

**Example:**

```bash
# Get first page (products 1-20)
GET /api/products?limit=20&offset=0

# Get second page (products 21-40)
GET /api/products?limit=20&offset=20

# Get third page (products 41-60)
GET /api/products?limit=20&offset=40
```

**Response includes:**
- `total`: Total number of products matching the query
- `hasMore`: Boolean indicating if more results are available

---

## Best Practices

### Caching

- Cache GET requests on the client side to reduce API calls
- Use the `updatedAt` timestamp to invalidate stale cache entries
- Implement cache-control headers for optimal performance

### Error Handling

Always check the response status code and handle errors gracefully:

```javascript
try {
  const response = await fetch('/api/products');
  if (!response.ok) {
    const error = await response.json();
    console.error('API Error:', error.error.message);
    // Handle error appropriately
  }
  const data = await response.json();
  // Process data
} catch (error) {
  console.error('Network Error:', error);
  // Handle network error
}
```

### Image Optimization

- Compress images before uploading (recommended: < 500KB)
- Use WebP format for better compression
- Generate multiple sizes for responsive images
- Always include descriptive alt text

### Security

- Never expose admin credentials in client-side code
- Validate all user input before sending to API
- Use HTTPS for all API requests
- Implement CSRF protection for admin operations

---

## Examples

### Complete Product Creation Flow

```javascript
// 1. Upload image
const uploadResponse = await fetch('/api/admin/upload-image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'product.jpg',
    fileType: 'image/jpeg'
  })
});
const { uploadUrl, imageUrl } = await uploadResponse.json();

// 2. Upload file to S3
await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg' },
  body: imageFile
});

// 3. Create product
const productResponse = await fetch('/api/admin/products', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Product',
    description: 'Product description',
    category: 'tech-electronics',
    imageUrl: imageUrl,
    amazonLink: 'https://amazon.com/dp/B08XYZ?tag=affiliate-20',
    price: '$29.99',
    published: true
  })
});
const { product } = await productResponse.json();
console.log('Created product:', product.id);
```

### Fetching Products with Pagination

```javascript
async function fetchAllProducts(category) {
  const allProducts = [];
  let offset = 0;
  const limit = 20;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `/api/products?category=${category}&limit=${limit}&offset=${offset}`
    );
    const { products, hasMore: more } = await response.json();
    
    allProducts.push(...products);
    hasMore = more;
    offset += limit;
  }

  return allProducts;
}
```

---

## Support

For API issues or questions:
1. Check CloudWatch logs for Lambda function errors
2. Verify your API Gateway URL is correct
3. Ensure CORS is properly configured
4. Review this documentation for correct usage

For additional help, refer to the main [README.md](./README.md) troubleshooting section.
