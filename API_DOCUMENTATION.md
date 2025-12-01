# API Documentation

Complete reference for the Pinterest Affiliate Platform REST API.

## Base URL

```
https://<api-id>.execute-api.<region>.amazonaws.com/prod
```

Replace `<api-id>` and `<region>` with your API Gateway deployment values.

## Authentication

Currently, the API does not require authentication for public endpoints. Admin endpoints may optionally be protected by a simple password mechanism or AWS Amplify Auth (implementation dependent).

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
- `404 Not Found` - Resource not found
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

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Public endpoints**: 1000 requests per minute per IP
- **Admin endpoints**: 100 requests per minute per IP

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
