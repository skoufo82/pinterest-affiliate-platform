# Google Analytics 4 Setup Guide - Pinterest Affiliate Platform

## 🎯 Overview

This guide will help you set up Google Analytics 4 (GA4) to track site traffic and display analytics in your admin portal.

**What's Included:**
- ✅ Page view tracking
- ✅ Product view tracking
- ✅ Affiliate click tracking (conversions)
- ✅ Category view tracking
- ✅ Search tracking
- ✅ Social share tracking
- ✅ Error tracking
- ✅ Performance metrics

---

## 📋 Step 1: Create Google Analytics 4 Property

### 1.1 Sign Up / Sign In

1. Go to https://analytics.google.com/
2. Sign in with your Google account
3. Click "Start measuring" or "Admin" (gear icon)

### 1.2 Create Property

1. Click "Create Property"
2. Enter property details:
   - **Property name**: Pinterest Affiliate Platform (or koufobunch.com)
   - **Reporting time zone**: Your timezone
   - **Currency**: USD
3. Click "Next"

### 1.3 Business Information

1. Select your industry category: **Shopping**
2. Select business size: **Small** (1-10 employees)
3. Select how you intend to use Google Analytics:
   - ☑️ Measure advertising ROI
   - ☑️ Examine user behavior
4. Click "Create"

### 1.4 Accept Terms of Service

1. Select your country
2. Read and accept the terms
3. Click "I Accept"

### 1.5 Create Data Stream

1. Select platform: **Web**
2. Enter website details:
   - **Website URL**: https://koufobunch.com
   - **Stream name**: Pinterest Affiliate Platform
3. Click "Create stream"

### 1.6 Get Your Measurement ID

1. You'll see your **Measurement ID** (format: G-XXXXXXXXXX)
2. **Copy this ID** - you'll need it in the next step

---

## 🔧 Step 2: Configure Your Application

### 2.1 Add Measurement ID to Environment Variables

**For Local Development:**

```bash
# In frontend/.env.local
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

**For Production (AWS Amplify):**

1. Go to AWS Amplify Console
2. Select your app
3. Go to "Environment variables"
4. Add new variable:
   - **Key**: `VITE_GA_TRACKING_ID`
   - **Value**: `G-XXXXXXXXXX` (your actual Measurement ID)
5. Click "Save"
6. Redeploy your app

### 2.2 Verify Installation

1. Start your local development server:
   ```bash
   cd frontend
   npm run dev
   ```

2. Open your browser to `http://localhost:5173`

3. Open browser DevTools (F12)

4. Check Console for:
   ```
   Google Analytics initialized: G-XXXXXXXXXX
   ```

5. Go to Network tab and filter by "google-analytics" or "collect"
   - You should see requests being sent to GA4

---

## 📊 Step 3: Verify Data Collection

### 3.1 Real-Time Reports

1. Go to Google Analytics
2. Click "Reports" → "Realtime"
3. Open your website in another tab
4. You should see yourself as an active user!

### 3.2 Test Events

**Test Product View:**
1. Click on any product card
2. In GA4 Realtime → Events, you should see:
   - `page_view`
   - `view_item`

**Test Affiliate Click:**
1. Click "Shop Now" on any product
2. In GA4 Realtime → Events, you should see:
   - `affiliate_click`
   - `select_content`

### 3.3 Wait for Historical Data

- Real-time data appears immediately
- Historical reports take 24-48 hours to populate
- Come back tomorrow to see full analytics!

---

## 🎨 Step 4: Configure GA4 for Better Insights

### 4.1 Mark Conversions

1. In GA4, go to "Configure" → "Events"
2. Find `affiliate_click` event
3. Toggle "Mark as conversion" ✅
4. This tracks affiliate clicks as conversions!

### 4.2 Create Custom Dimensions (Optional)

1. Go to "Configure" → "Custom definitions"
2. Click "Create custom dimension"
3. Add useful dimensions:
   - **Product Category**: `category`
   - **Product ID**: `product_id`
   - **Product Name**: `product_name`

### 4.3 Set Up Enhanced Measurement

1. Go to "Admin" → "Data Streams"
2. Click your web stream
3. Click "Enhanced measurement"
4. Ensure these are enabled:
   - ☑️ Page views
   - ☑️ Scrolls
   - ☑️ Outbound clicks
   - ☑️ Site search
   - ☑️ Video engagement
   - ☑️ File downloads

---

## 📈 Step 5: Key Metrics to Monitor

### Traffic Metrics
- **Users**: Total unique visitors
- **Sessions**: Total visits
- **Page Views**: Total pages viewed
- **Bounce Rate**: % of single-page sessions
- **Average Session Duration**: Time spent on site

### Business Metrics
- **Product Views**: `view_item` events
- **Affiliate Clicks**: `affiliate_click` conversions
- **Click-Through Rate**: Affiliate clicks / Product views
- **Top Products**: Most viewed products
- **Top Categories**: Most popular categories

### Acquisition Metrics
- **Traffic Sources**: Where visitors come from
- **Referrals**: Which sites send traffic
- **Social Traffic**: Traffic from social media
- **Direct Traffic**: Users typing your URL

---

## 🔍 Step 6: Useful GA4 Reports

### 6.1 Traffic Overview

**Path**: Reports → Life cycle → Acquisition → Traffic acquisition

**What it shows**:
- Where your visitors come from
- Organic search, direct, referral, social

### 6.2 Page Performance

**Path**: Reports → Life cycle → Engagement → Pages and screens

**What it shows**:
- Most viewed pages
- Average time on page
- Bounce rate per page

### 6.3 Events Report

**Path**: Reports → Life cycle → Engagement → Events

**What it shows**:
- All tracked events
- Event counts
- Conversion events

### 6.4 Real-Time

**Path**: Reports → Realtime

**What it shows**:
- Current active users
- Pages being viewed right now
- Events happening in real-time

---

## 🎯 Step 7: Create Custom Reports (Optional)

### 7.1 Product Performance Report

1. Go to "Explore" → "Blank"
2. Add dimensions:
   - Event name
   - Page path
   - Product name (custom dimension)
3. Add metrics:
   - Event count
   - Total users
4. Add filter: Event name = `view_item`
5. Save as "Product Performance"

### 7.2 Affiliate Conversion Report

1. Go to "Explore" → "Blank"
2. Add dimensions:
   - Product name
   - Product category
3. Add metrics:
   - Conversions (affiliate_click)
   - Event count
4. Save as "Affiliate Conversions"

---

## 🚀 What's Tracking Now

### Automatic Tracking

✅ **Page Views**: Every page navigation
✅ **Product Views**: When users click on products
✅ **Affiliate Clicks**: When users click "Shop Now"
✅ **Category Views**: When users browse categories
✅ **Errors**: JavaScript errors and exceptions

### Events Being Tracked

| Event Name | When It Fires | Purpose |
|------------|---------------|---------|
| `page_view` | Every page load | Track navigation |
| `view_item` | Product card click | Track product interest |
| `affiliate_click` | "Shop Now" click | Track conversions |
| `select_content` | Affiliate link click | Standard conversion |
| `view_item_list` | Category page view | Track category interest |
| `search` | Search query | Track search behavior |
| `share` | Social share | Track viral potential |
| `exception` | JavaScript error | Track technical issues |

---

## 🎨 Next Steps: Admin Dashboard (Coming Soon)

In Phase 2, we'll add:
- Analytics dashboard in admin portal
- Real-time visitor count
- Top products widget
- Conversion rate charts
- Traffic source breakdown
- Custom date range selection

This will use the **GA4 Reporting API** to pull data directly into your admin panel.

---

## 🔧 Troubleshooting

### Issue: No data in GA4

**Check:**
1. Measurement ID is correct in `.env.local`
2. Console shows "Google Analytics initialized"
3. Network tab shows requests to `google-analytics.com`
4. Ad blockers are disabled (they block GA)
5. Wait 24-48 hours for historical data

### Issue: Events not showing

**Check:**
1. Real-time reports (not historical)
2. Click on products and "Shop Now" buttons
3. Check browser console for errors
4. Verify GA4 is initialized before events fire

### Issue: Conversions not tracking

**Check:**
1. Mark `affiliate_click` as conversion in GA4
2. Wait 24 hours for conversion data
3. Test by clicking "Shop Now" buttons

### Issue: Data in development but not production

**Check:**
1. Environment variable set in Amplify Console
2. App redeployed after adding variable
3. Check production console for initialization message

---

## 📚 Resources

- [GA4 Documentation](https://support.google.com/analytics/answer/10089681)
- [GA4 Events Reference](https://support.google.com/analytics/answer/9267735)
- [GA4 Reporting API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Enhanced Ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce)

---

## ✅ Checklist

- [ ] Created GA4 property
- [ ] Got Measurement ID (G-XXXXXXXXXX)
- [ ] Added to `.env.local` for development
- [ ] Added to Amplify environment variables
- [ ] Verified initialization in console
- [ ] Tested in Real-time reports
- [ ] Marked `affiliate_click` as conversion
- [ ] Configured enhanced measurement
- [ ] Bookmarked key reports
- [ ] Waiting for historical data (24-48 hours)

---

**Congratulations!** 🎉 Your analytics are now tracking. Check back in 24-48 hours to see your first full day of data!

---

*Last Updated: December 2024*
