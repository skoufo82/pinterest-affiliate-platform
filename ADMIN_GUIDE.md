# Admin Dashboard User Guide

Complete guide for managing products on the Pinterest Affiliate Platform.

## Table of Contents

1. [Accessing the Admin Dashboard](#accessing-the-admin-dashboard)
2. [Dashboard Overview](#dashboard-overview)
3. [Managing Products](#managing-products)
4. [Adding New Products](#adding-new-products)
5. [Editing Products](#editing-products)
6. [Deleting Products](#deleting-products)
7. [Image Management](#image-management)
8. [Category Management](#category-management)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Accessing the Admin Dashboard

### Local Development

Navigate to: `http://localhost:5173/admin`

### Production

Navigate to: `https://your-amplify-domain.amplifyapp.com/admin`

**Note:** If admin authentication is enabled, you'll need to enter the admin password configured in your environment variables.

---

## Dashboard Overview

The admin dashboard provides a centralized interface for managing your product catalog.

### Main Sections

1. **Dashboard Home** - Quick stats and recent products
2. **Product List** - View and manage all products
3. **Add Product** - Create new products
4. **Edit Product** - Modify existing products

### Navigation

Use the sidebar menu to navigate between sections:
- **Dashboard** - Return to the main dashboard
- **Products** - View all products
- **Add New** - Create a new product

---

## Managing Products

### Viewing All Products

1. Click **Products** in the sidebar
2. The product table displays:
   - Product title
   - Category
   - Published status
   - Action buttons (Edit, Delete)

### Filtering Products

Use the category filter dropdown to view products from a specific category:

1. Click the **Category** dropdown
2. Select a category (or "All Categories")
3. The table updates to show filtered results

### Sorting Products

Click on column headers to sort:
- **Title** - Alphabetical order
- **Category** - Group by category
- **Published** - Show published/unpublished first
- **Created** - Sort by creation date

---

## Adding New Products

### Step-by-Step Guide

1. **Navigate to Add Product**
   - Click **Add New** in the sidebar
   - Or click the **Add Product** button on the product list page

2. **Fill in Product Details**

   **Required Fields:**
   - **Title** - Product name (max 200 characters)
     - Example: "Wireless Bluetooth Headphones"
   
   - **Description** - Detailed product description (max 2000 characters)
     - Example: "Premium noise-canceling headphones with 30-hour battery life. Features active noise cancellation, comfortable over-ear design, and superior sound quality."
   
   - **Category** - Select from dropdown
     - Options: Home & Kitchen, Fashion & Beauty, Tech & Electronics, Health & Wellness, Books & Stationery
   
   - **Amazon Link** - Full Amazon affiliate URL
     - Example: `https://amazon.com/dp/B08XYZ?tag=youraffid-20`
     - **Important:** Include your affiliate tag!
   
   - **Image** - Upload product image (see [Image Management](#image-management))

   **Optional Fields:**
   - **Price** - Display price (e.g., "$29.99")
   - **Tags** - Comma-separated tags for organization
     - Example: "tech, audio, wireless"
   
   - **Published** - Toggle to make product visible on public site
     - ✓ Published - Visible to visitors
     - ✗ Unpublished - Hidden from public (draft mode)

3. **Upload Product Image**
   - Click **Choose File** or drag and drop
   - Supported formats: JPEG, PNG, WebP
   - Recommended size: 800x800px or larger
   - Maximum file size: 5MB
   - See [Image Management](#image-management) for details

4. **Preview Your Product**
   - Review all fields for accuracy
   - Check that the image displays correctly
   - Verify the Amazon link is correct

5. **Save Product**
   - Click **Create Product** button
   - Wait for confirmation message
   - You'll be redirected to the dashboard

### Tips for Adding Products

- **Write compelling descriptions** - Help visitors understand why they should buy
- **Use high-quality images** - Clear, well-lit product photos perform best
- **Include relevant tags** - Makes products easier to find and organize
- **Test affiliate links** - Click the link to ensure it works before publishing
- **Start as unpublished** - Create drafts and publish when ready

---

## Editing Products

### How to Edit a Product

1. **Find the Product**
   - Navigate to the **Products** page
   - Use the category filter if needed
   - Locate the product you want to edit

2. **Open Edit Form**
   - Click the **Edit** button (pencil icon) next to the product
   - The edit form opens with pre-filled data

3. **Make Changes**
   - Modify any fields you want to update
   - All fields are editable except the product ID
   - The creation date is preserved

4. **Update Image (Optional)**
   - Upload a new image to replace the existing one
   - The old image URL will be replaced
   - See [Image Management](#image-management)

5. **Save Changes**
   - Click **Update Product** button
   - Wait for confirmation message
   - Changes are immediately reflected on the public site

### Common Edits

**Update Price:**
- Change the price field to reflect current pricing
- Use format: "$XX.XX"

**Change Published Status:**
- Toggle the Published checkbox
- Unpublish to temporarily hide a product
- Republish when ready to show again

**Update Description:**
- Improve product descriptions based on performance
- Add more details or benefits
- Fix typos or formatting

**Replace Image:**
- Upload a better quality image
- Update seasonal images
- Fix incorrect images

---

## Deleting Products

### How to Delete a Product

1. **Find the Product**
   - Navigate to the **Products** page
   - Locate the product you want to delete

2. **Click Delete Button**
   - Click the **Delete** button (trash icon)
   - A confirmation dialog appears

3. **Confirm Deletion**
   - Read the confirmation message carefully
   - Click **Confirm** to permanently delete
   - Or click **Cancel** to keep the product

4. **Verify Deletion**
   - The product is removed from the list
   - A success message appears
   - The product is no longer visible on the public site

### Important Notes

- **Deletion is permanent** - Products cannot be recovered after deletion
- **Consider unpublishing instead** - Set Published to false to hide without deleting
- **Check for dependencies** - Ensure no external links point to the product
- **Backup data** - Export product data before bulk deletions

### When to Delete vs. Unpublish

**Delete when:**
- Product is discontinued permanently
- Product was added by mistake
- Duplicate product exists
- Product violates Amazon's terms

**Unpublish when:**
- Product is temporarily out of stock
- Testing changes before going live
- Seasonal products (hide off-season)
- Product needs major updates

---

## Image Management

### Image Requirements

**Technical Specifications:**
- **Formats:** JPEG, PNG, WebP
- **Maximum size:** 5MB
- **Recommended dimensions:** 800x800px or larger
- **Aspect ratio:** Square (1:1) works best for Pinterest-style layout

**Quality Guidelines:**
- Use high-resolution images
- Ensure good lighting and clarity
- Show product clearly without clutter
- Use white or neutral backgrounds when possible

### Uploading Images

1. **Click Upload Area**
   - Click "Choose File" button
   - Or drag and drop image file

2. **Select Image**
   - Browse your computer
   - Select the product image
   - Click Open

3. **Preview**
   - Image preview appears immediately
   - Verify the image looks correct
   - Upload progress indicator shows status

4. **Wait for Upload**
   - Image uploads to S3 automatically
   - Progress bar shows upload status
   - Don't navigate away during upload

5. **Confirmation**
   - Success message appears when complete
   - Image URL is automatically saved
   - Continue filling out other fields

### Image Best Practices

**Optimization:**
- Compress images before uploading (use tools like TinyPNG)
- Target file size: 200-500KB for optimal loading
- Use WebP format for best compression
- Maintain aspect ratio when resizing

**Content:**
- Show product from best angle
- Include product in use when relevant
- Avoid text overlays (use description instead)
- Ensure image matches product description

**Pinterest Optimization:**
- Vertical images (2:3 ratio) perform well on Pinterest
- Bright, colorful images attract more clicks
- Lifestyle images (product in context) engage better
- Consistent style across products builds brand

### Replacing Images

To replace an existing product image:

1. Edit the product
2. Upload a new image (old image is automatically replaced)
3. Save the product
4. Old image URL is overwritten with new URL

**Note:** The old image file remains in S3 but is no longer referenced. Consider periodic cleanup of unused images.

### Troubleshooting Image Issues

**Image won't upload:**
- Check file size (must be < 5MB)
- Verify file format (JPEG, PNG, or WebP only)
- Ensure stable internet connection
- Try compressing the image

**Image appears distorted:**
- Check original image dimensions
- Ensure aspect ratio is maintained
- Re-upload with correct dimensions

**Image loads slowly:**
- Compress image to reduce file size
- Use WebP format for better compression
- Check image dimensions (don't upload unnecessarily large images)

---

## Category Management

### Available Categories

The platform includes these predefined categories:

1. **Home & Kitchen** (`home-kitchen`)
   - Kitchen gadgets, home decor, organization

2. **Fashion & Beauty** (`fashion-beauty`)
   - Clothing, accessories, beauty products

3. **Tech & Electronics** (`tech-electronics`)
   - Gadgets, electronics, tech accessories

4. **Health & Wellness** (`health-wellness`)
   - Fitness equipment, wellness products, health items

5. **Books & Stationery** (`books-stationery`)
   - Books, journals, office supplies, stationery

### Assigning Categories

When creating or editing a product:

1. Click the **Category** dropdown
2. Select the most appropriate category
3. Choose only one category per product

### Category Best Practices

- **Be specific** - Choose the most relevant category
- **Stay consistent** - Use the same category for similar products
- **Consider user intent** - Think about how visitors will browse
- **Balance categories** - Try to have products in all categories

### Adding New Categories

Currently, categories are predefined in the system. To add new categories:

1. Update the seed script (`backend/scripts/seed.ts`)
2. Add the new category to the categories array
3. Run the seed script to add to database
4. Update the frontend category dropdown

**Note:** This requires developer access. Contact your development team to add new categories.

---

## Best Practices

### Product Descriptions

**Do:**
- Write clear, compelling descriptions
- Highlight key features and benefits
- Use bullet points for readability
- Include relevant keywords for SEO
- Mention what makes the product special

**Don't:**
- Copy Amazon descriptions verbatim (copyright issues)
- Use excessive capitalization or exclamation marks
- Include pricing in description (use price field)
- Make false or exaggerated claims
- Forget to proofread for typos

### Amazon Affiliate Links

**Important Guidelines:**
- Always include your affiliate tag in links
- Format: `https://amazon.com/dp/PRODUCTID?tag=youraffid-20`
- Test links before publishing
- Update broken links promptly
- Comply with Amazon Associates terms

**Checking Your Links:**
1. Copy the Amazon link
2. Paste in a new browser tab
3. Verify it goes to the correct product
4. Check that your affiliate tag is present in the URL

### Publishing Strategy

**Before Publishing:**
- Review all product details for accuracy
- Test the Amazon affiliate link
- Verify image displays correctly
- Check spelling and grammar
- Preview on mobile if possible

**After Publishing:**
- Visit the public site to verify product appears
- Test the "Shop Now" button
- Share on Pinterest to drive traffic
- Monitor performance and engagement

### Content Quality

**High-Quality Products:**
- Detailed, helpful descriptions
- Professional product images
- Accurate pricing information
- Working affiliate links
- Relevant tags and categories

**Avoid:**
- Duplicate products
- Low-quality or blurry images
- Broken or incorrect links
- Misleading descriptions
- Products that violate Amazon's terms

### Workflow Tips

**Efficient Product Management:**
1. Batch similar products together
2. Prepare images before starting
3. Keep Amazon links in a spreadsheet
4. Use consistent formatting
5. Save drafts (unpublished) and review later

**Regular Maintenance:**
- Review products monthly
- Update prices as needed
- Replace outdated images
- Remove discontinued products
- Fix broken links

---

## Troubleshooting

### Common Issues

#### "Failed to create product"

**Possible causes:**
- Missing required fields
- Invalid Amazon link format
- Image upload failed
- Network connection issue

**Solutions:**
1. Check all required fields are filled
2. Verify Amazon link includes `https://`
3. Ensure image uploaded successfully
4. Check internet connection
5. Try again after a few moments

#### "Image upload failed"

**Possible causes:**
- File too large (> 5MB)
- Unsupported file format
- Network timeout
- S3 permissions issue

**Solutions:**
1. Compress image to reduce file size
2. Convert to JPEG, PNG, or WebP
3. Check internet connection
4. Try uploading again
5. Contact support if issue persists

#### "Product not appearing on public site"

**Possible causes:**
- Product is unpublished
- Cache not cleared
- Wrong category selected
- Browser cache issue

**Solutions:**
1. Verify Published checkbox is checked
2. Wait a few minutes for cache to clear
3. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
4. Check category filter on public site
5. Clear browser cache

#### "Cannot edit product"

**Possible causes:**
- Product ID not found
- Network issue
- Permission issue

**Solutions:**
1. Refresh the product list
2. Check internet connection
3. Try logging out and back in
4. Contact support if issue persists

#### "Delete confirmation not appearing"

**Possible causes:**
- JavaScript error
- Browser compatibility issue
- Modal blocked by popup blocker

**Solutions:**
1. Refresh the page
2. Try a different browser
3. Disable popup blockers
4. Check browser console for errors

### Getting Help

If you encounter issues not covered here:

1. **Check the logs**
   - Open browser developer console (F12)
   - Look for error messages in the Console tab
   - Take a screenshot of any errors

2. **Verify configuration**
   - Ensure API URL is correct
   - Check environment variables
   - Verify AWS services are running

3. **Contact support**
   - Provide detailed description of the issue
   - Include screenshots if possible
   - Mention what you were trying to do
   - Note any error messages

4. **Additional resources**
   - [README.md](./README.md) - Setup and deployment
   - [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
   - [AMPLIFY_TESTING.md](./AMPLIFY_TESTING.md) - Testing guide

---

## Keyboard Shortcuts

Speed up your workflow with these keyboard shortcuts:

- **Ctrl/Cmd + S** - Save product (when in form)
- **Esc** - Close modal or dialog
- **Tab** - Navigate between form fields
- **Enter** - Submit form (when focused on input)

---

## Tips for Success

### Growing Your Catalog

1. **Start small** - Add 10-15 quality products initially
2. **Expand gradually** - Add new products weekly
3. **Monitor performance** - Track which products get clicks
4. **Refresh content** - Update descriptions and images regularly
5. **Stay current** - Add trending products in your niche

### Maximizing Affiliate Revenue

1. **Choose quality products** - Products you'd actually recommend
2. **Write compelling descriptions** - Help visitors make decisions
3. **Use great images** - Visual appeal drives clicks
4. **Test different products** - See what resonates with your audience
5. **Promote on Pinterest** - Drive traffic to your products

### Maintaining Quality

1. **Regular audits** - Review products monthly
2. **Update pricing** - Keep prices current
3. **Fix broken links** - Test links periodically
4. **Improve descriptions** - Refine based on performance
5. **Remove underperformers** - Focus on what works

---

## Compliance & Legal

### Amazon Associates Requirements

- Display required affiliate disclosure on all pages
- Don't modify Amazon product images
- Don't make price guarantees
- Update prices within 24 hours if displaying
- Follow Amazon's Operating Agreement

### FTC Guidelines

- Clearly disclose affiliate relationships
- Be honest in product recommendations
- Don't make false claims
- Disclose material connections

**The platform includes a footer with affiliate disclosure on all pages to help you comply with these requirements.**

---

## Conclusion

You now have everything you need to effectively manage your Pinterest Affiliate Platform! 

**Quick Start Checklist:**
- ✓ Access admin dashboard
- ✓ Add your first product
- ✓ Upload a quality image
- ✓ Test the affiliate link
- ✓ Publish and verify on public site
- ✓ Share on Pinterest

For additional help, refer to the other documentation files or contact support.

Happy selling! 🎉
