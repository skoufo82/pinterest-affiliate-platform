# Add Google Analytics to AWS Amplify - Quick Guide

## ✅ Local Development - DONE!

Your GA4 tracking ID has been added to `frontend/.env.local`:
```
VITE_GA_TRACKING_ID=G-BG5RKB13Y2
```

## 🚀 Production Deployment - Add to Amplify

### Step 1: Go to AWS Amplify Console

1. Open AWS Console: https://console.aws.amazon.com/amplify/
2. Select your app: **pinterest-affiliate-platform** (App ID: d2zsamo7mttch3)
3. Click on your app name

### Step 2: Add Environment Variable

1. In the left sidebar, click **"Environment variables"**
2. Click **"Manage variables"** button
3. Click **"Add variable"**
4. Enter the following:
   - **Variable name**: `VITE_GA_TRACKING_ID`
   - **Value**: `G-BG5RKB13Y2`
5. Click **"Save"**

### Step 3: Redeploy

**Option A: Automatic (Recommended)**
```bash
# Just push any change to trigger redeploy
git commit --allow-empty -m "Trigger redeploy for GA4 config"
git push origin main
```

**Option B: Manual**
1. In Amplify Console, go to your app
2. Click **"Run build"** or **"Redeploy this version"**
3. Wait for build to complete (~5 minutes)

### Step 4: Verify Production

1. Visit your production site: https://koufobunch.com
2. Open browser DevTools (F12)
3. Go to Console tab
4. Look for: `Google Analytics initialized: G-BG5RKB13Y2`
5. Go to Network tab, filter by "google-analytics"
6. You should see requests being sent!

### Step 5: Check GA4 Real-Time

1. Go to https://analytics.google.com/
2. Select your property
3. Click **"Reports"** → **"Realtime"**
4. Open your production site in another tab
5. You should see yourself as an active user! 🎉

---

## 🎯 What's Tracking Now

Once deployed, your site will automatically track:

- ✅ **Page Views**: Every page navigation
- ✅ **Product Views**: When users click on products
- ✅ **Affiliate Clicks**: When users click "Shop Now" (YOUR CONVERSIONS!)
- ✅ **Category Views**: When users browse categories
- ✅ **Search Queries**: When users search
- ✅ **Social Shares**: When users share products
- ✅ **Errors**: JavaScript errors for debugging

---

## 📊 View Your Analytics

### Real-Time (Immediate)
https://analytics.google.com/analytics/web/#/realtime

**What you'll see:**
- Active users right now
- Pages being viewed
- Events firing live
- Geographic location
- Device types

### Historical (24-48 hours)
https://analytics.google.com/analytics/web/#/report-home

**What you'll see:**
- Total visitors & sessions
- Top products & categories
- Conversion rate (affiliate clicks)
- Traffic sources
- User demographics
- Engagement metrics

---

## 🎨 Configure GA4 for Better Insights

### Mark Conversions

1. In GA4, go to **"Configure"** → **"Events"**
2. Find `affiliate_click` event
3. Toggle **"Mark as conversion"** ✅
4. This tracks your affiliate clicks as conversions!

### Create Custom Reports

**Product Performance:**
1. Go to **"Explore"** → **"Blank"**
2. Add dimension: `Event name`
3. Add metric: `Event count`
4. Filter: `Event name = view_item`
5. Save as "Product Performance"

**Affiliate Conversions:**
1. Go to **"Explore"** → **"Blank"**
2. Add dimension: `Event name`
3. Add metric: `Conversions`
4. Filter: `Event name = affiliate_click`
5. Save as "Affiliate Conversions"

---

## 🔍 Test Your Setup

### Local Testing (Now)

```bash
cd frontend
npm run dev
```

1. Open http://localhost:5173
2. Open DevTools Console (F12)
3. Look for: `Google Analytics initialized: G-BG5RKB13Y2`
4. Click on products and "Shop Now" buttons
5. Check Network tab for GA requests

### Production Testing (After Deploy)

1. Visit https://koufobunch.com
2. Open DevTools Console
3. Verify initialization message
4. Click around the site
5. Check GA4 Real-Time reports
6. You should see events firing!

---

## 📈 Key Metrics to Monitor

### Traffic Metrics
- **Users**: Total unique visitors
- **Sessions**: Total visits
- **Page Views**: Total pages viewed
- **Bounce Rate**: % of single-page sessions

### Business Metrics (Most Important!)
- **Product Views**: `view_item` events
- **Affiliate Clicks**: `affiliate_click` conversions
- **Click-Through Rate**: Clicks / Views (aim for 5-10%)
- **Top Products**: Most viewed products
- **Top Categories**: Most popular categories

### Acquisition Metrics
- **Traffic Sources**: Where visitors come from
- **Referrals**: Which sites send traffic
- **Social Traffic**: Traffic from social media
- **Direct Traffic**: Users typing your URL

---

## ✅ Checklist

- [x] GA4 property created
- [x] Measurement ID obtained: G-BG5RKB13Y2
- [x] Added to local `.env.local`
- [x] Tested locally (verify in console)
- [ ] **Add to Amplify environment variables**
- [ ] **Redeploy production**
- [ ] **Verify in production console**
- [ ] **Check GA4 Real-Time reports**
- [ ] **Mark `affiliate_click` as conversion**
- [ ] **Bookmark GA4 dashboard**

---

## 🎉 You're Almost Done!

Just add the environment variable to Amplify and redeploy. Your analytics will start tracking immediately!

**Next Steps:**
1. Add to Amplify (5 minutes)
2. Redeploy (5 minutes)
3. Verify in GA4 Real-Time
4. Watch your data roll in! 📊

---

*Questions? Check ANALYTICS_SETUP_GUIDE.md for detailed instructions.*
