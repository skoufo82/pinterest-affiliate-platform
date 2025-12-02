# Google AdSense Setup Guide

## ✅ Current Status
- AdSense verification code: **Added** ✓
- Account status: **Approved** ✓
- Ad components: **Created** ✓
- Ad placements: **Implemented** ✓

## 📍 Ad Placements on Your Site

### Homepage
1. **Banner Ad** - Top of page (below hero)
2. **Sidebar Ad** - Right sidebar (sticky, desktop only)

### Category Pages
1. **Sidebar Ad** - Right sidebar (sticky, desktop only)
2. **In-Feed Ad** - After 8+ products

### Product Detail Pages
- Ready for ads (can be added next)

## 🎯 Next Steps: Get Your Ad Slot IDs

### Step 1: Create Ad Units in AdSense

1. Go to: https://adsense.google.com
2. Click **Ads** → **By ad unit**
3. Click **+ New ad unit**

### Step 2: Create These 3 Ad Units

#### Ad Unit 1: Sidebar Ad
- **Name**: `Sidebar Rectangle`
- **Type**: Display ads
- **Size**: Responsive
- **Click**: Create
- **Copy the Ad Slot ID** (looks like: `1234567890`)

#### Ad Unit 2: In-Feed Ad
- **Name**: `In-Feed Ad`
- **Type**: In-feed ads
- **Size**: Responsive
- **Click**: Create
- **Copy the Ad Slot ID**

#### Ad Unit 3: Banner Ad
- **Name**: `Top Banner`
- **Type**: Display ads
- **Size**: Responsive (or 728x90 leaderboard)
- **Click**: Create
- **Copy the Ad Slot ID**

### Step 3: Update Ad Components with Your Slot IDs

Once you have your ad slot IDs, update these files:

#### 1. Update `frontend/src/components/ads/SidebarAd.tsx`
```typescript
<AdSenseAd
  adSlot="YOUR_SIDEBAR_AD_SLOT" // Replace with actual slot ID
  adFormat="rectangle"
  style={{ minHeight: '250px', minWidth: '300px' }}
/>
```

#### 2. Update `frontend/src/components/ads/InFeedAd.tsx`
```typescript
<AdSenseAd
  adSlot="YOUR_INFEED_AD_SLOT" // Replace with actual slot ID
  adFormat="fluid"
  style={{ minHeight: '200px' }}
/>
```

#### 3. Update `frontend/src/components/ads/BannerAd.tsx`
```typescript
<AdSenseAd
  adSlot="YOUR_BANNER_AD_SLOT" // Replace with actual slot ID
  adFormat="horizontal"
  style={{ minHeight: '90px' }}
/>
```

### Step 4: Deploy

After updating the ad slot IDs:

```bash
cd frontend
npm run build
git add -A
git commit -m "Add AdSense ad slot IDs"
git push
```

Then trigger Amplify deployment:
```bash
aws amplify start-job --app-id d2zsamo7mttch3 --branch-name main --job-type RELEASE --profile default
```

## 📊 Ad Performance Tips

### Best Practices
1. **Don't overload pages** - Max 3 ads per page
2. **Strategic placement** - Near content, not intrusive
3. **Mobile-friendly** - Ads are responsive
4. **Clear labeling** - "Advertisement" text above ads
5. **Monitor performance** - Check AdSense dashboard regularly

### Expected Timeline
- **First 24-48 hours**: Ads may show as blank or test ads
- **After 48 hours**: Real ads should start showing
- **First week**: Performance data becomes available
- **First month**: Optimization kicks in

### Revenue Expectations
- **Low traffic (< 1k/day)**: $1-5/day
- **Medium traffic (1k-10k/day)**: $5-50/day
- **High traffic (10k+/day)**: $50-500+/day

*Actual revenue varies by niche, traffic quality, and user engagement*

## 🎨 Ad Customization

### Change Ad Sizes
Edit the `style` prop in each component:

```typescript
// Square ad
style={{ minHeight: '250px', minWidth: '250px' }}

// Wide banner
style={{ minHeight: '90px', minWidth: '728px' }}

// Vertical skyscraper
style={{ minHeight: '600px', minWidth: '160px' }}
```

### Add More Ad Placements

To add ads to other pages, import and use the components:

```typescript
import { SidebarAd } from '@/components/ads/SidebarAd';
import { InFeedAd } from '@/components/ads/InFeedAd';
import { BannerAd } from '@/components/ads/BannerAd';

// Then use in your component:
<BannerAd />
<SidebarAd />
<InFeedAd />
```

## 🚫 Troubleshooting

### Ads Not Showing
1. **Wait 24-48 hours** - New sites take time
2. **Check ad slot IDs** - Make sure they're correct
3. **Verify AdSense approval** - Check your AdSense dashboard
4. **Check browser console** - Look for errors
5. **Disable ad blockers** - Test without ad blocking extensions

### Ads Showing Blank
- Normal for first 24-48 hours
- AdSense is learning your audience
- Test ads may show initially

### Low Revenue
- **Increase traffic** - More visitors = more revenue
- **Improve content** - Better content = higher CPM
- **Optimize placement** - Test different positions
- **Check niche** - Some niches pay more than others

## 📈 Future Enhancements

Once you have steady traffic, consider:

1. **A/B testing** - Test different ad placements
2. **Sticky ads** - Keep sidebar ads visible while scrolling
3. **Auto ads** - Let Google automatically place ads
4. **Anchor ads** - Mobile bottom banner ads
5. **Vignette ads** - Full-screen ads between pages

## 🔗 Useful Links

- AdSense Dashboard: https://adsense.google.com
- Ad Units: https://adsense.google.com/u/0/adsense/main/ads/ad-units
- Performance Reports: https://adsense.google.com/u/0/adsense/main/reports
- Policy Center: https://adsense.google.com/u/0/adsense/main/policy-center

## 💰 Revenue Optimization

### High-Value Ad Positions
1. **Above the fold** - Visible without scrolling
2. **Within content** - Between paragraphs/products
3. **Sidebar** - Sticky ads that follow scroll
4. **End of content** - After user finishes reading

### Low-Value Positions (Avoid)
- Footer only
- Hidden on mobile
- Too many ads clustered together
- Ads that push content down

## 📱 Mobile Optimization

All ad components are mobile-responsive:
- Sidebar ads hidden on mobile (< 1024px)
- Banner and in-feed ads adapt to screen size
- No horizontal scrolling
- Fast loading with lazy loading

## ✅ Checklist

- [x] AdSense account created
- [x] Site verified with AdSense
- [x] Account approved
- [x] Ad components created
- [x] Ads placed on homepage
- [x] Ads placed on category pages
- [ ] Get ad slot IDs from AdSense
- [ ] Update ad components with slot IDs
- [ ] Deploy updated code
- [ ] Wait 24-48 hours for ads to show
- [ ] Monitor performance in AdSense dashboard
