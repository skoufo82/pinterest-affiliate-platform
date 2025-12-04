# Analytics Implementation Guide - Pinterest Affiliate Platform

## Overview

This guide provides multiple approaches to track site traffic and display analytics in your admin portal, ranging from simple to advanced implementations.

---

## 📊 Recommended Approach: Multi-Tier Analytics

### Tier 1: Google Analytics 4 (GA4) - External Analytics
**Best for**: Comprehensive user behavior tracking, demographics, and standard web analytics

### Tier 2: Custom Event Tracking - Internal Analytics  
**Best for**: Business-specific metrics (product views, affiliate clicks, conversions)

### Tier 3: CloudWatch Logs - Infrastructure Analytics
**Best for**: API usage, performance metrics, error tracking

---

## 🎯 Option 1: Google Analytics 4 + Admin Dashboard (Recommended)

### Why This Approach?
- ✅ Free and powerful
- ✅ Real-time data
- ✅ No infrastructure to manage
- ✅ Industry-standard metrics
- ✅ Can embed in admin portal via GA4 Reporting API

### Implementation Steps

#### Step 1: Set Up Google Analytics 4

1. **Create GA4 Property**
   - Go to https://analytics.google.com/
   - Create new GA4 property
   - Get your Measurement ID (G-XXXXXXXXXX)

2. **Add GA4 to Frontend**

```typescript
// frontend/src/utils/analytics.ts
import ReactGA from 'react-ga4';

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_TRACKING_ID;

export const initGA = () => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID, {
      gaOptions: {
        siteSpeedSampleRate: 100,
      },
    });
  }
};

export const trackPageView = (path: string) => {
  ReactGA.send({ hitType: 'pageview', page: path });
};

export const trackEvent = (category: string, action: string, label?: string, value?: number) => {
  ReactGA.event({
    category,
    action,
    label,
    value,
  });
};

// Custom events for affiliate platform
export const trackProductView = (productId: string, productName: string) => {
  trackEvent('Product', 'View', productName);
};

export const trackAffiliateClick = (productId: string, productName: string, amazonLink: string) => {
  trackEvent('Affiliate', 'Click', productName);
  // Also track as conversion event
  ReactGA.event('affiliate_click', {
    product_id: productId,
    product_name: productName,
    link: amazonLink,
  });
};

export const trackCategoryView = (category: string) => {
  trackEvent('Category', 'View', category);
};

export const trackSearch = (searchTerm: string) => {
  trackEvent('Search', 'Query', searchTerm);
};
```

3. **Initialize in App**

```typescript
// frontend/src/App.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initGA, trackPageView } from './utils/analytics';

function App() {
  const location = useLocation();

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location]);

  // ... rest of app
}
```

4. **Track Events in Components**

```typescript
// frontend/src/components/public/ProductCard.tsx
import { trackProductView, trackAffiliateClick } from '@/utils/analytics';

const ProductCard = ({ product }) => {
  const handleProductClick = () => {
    trackProductView(product.id, product.title);
  };

  const handleAffiliateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    trackAffiliateClick(product.id, product.title, product.amazonLink);
  };

  // ... component code
};
```

#### Step 2: Create GA4 Reporting API Integration

1. **Set Up Google Cloud Project**
   - Enable Google Analytics Data API
   - Create service account
   - Download credentials JSON
   - Add service account email to GA4 property (Viewer role)

2. **Store Credentials in Parameter Store**

```bash
aws ssm put-parameter \
  --name "/analytics/ga4/credentials" \
  --value "$(cat service-account-key.json)" \
  --type "SecureString" \
  --description "GA4 Service Account Credentials"

aws ssm put-parameter \
  --name "/analytics/ga4/property-id" \
  --value "YOUR_GA4_PROPERTY_ID" \
  --type "String"
```

3. **Create Analytics Lambda Function**

```typescript
// backend/functions/getAnalytics/index.ts
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: process.env.REGION });

let analyticsClient: BetaAnalyticsDataClient | null = null;
let propertyId: string | null = null;

async function initializeGA4Client() {
  if (analyticsClient && propertyId) return { analyticsClient, propertyId };

  // Get credentials from Parameter Store
  const credentialsParam = await ssmClient.send(
    new GetParameterCommand({
      Name: '/analytics/ga4/credentials',
      WithDecryption: true,
    })
  );

  const propertyIdParam = await ssmClient.send(
    new GetParameterCommand({
      Name: '/analytics/ga4/property-id',
    })
  );

  const credentials = JSON.parse(credentialsParam.Parameter!.Value!);
  propertyId = propertyIdParam.Parameter!.Value!;

  analyticsClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
  });

  return { analyticsClient, propertyId };
}

export async function handler(event: any) {
  try {
    const { analyticsClient, propertyId } = await initializeGA4Client();

    const { startDate, endDate, metrics, dimensions } = JSON.parse(event.body || '{}');

    // Run report
    const [response] = await analyticsClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: startDate || '30daysAgo',
          endDate: endDate || 'today',
        },
      ],
      dimensions: dimensions || [
        { name: 'date' },
        { name: 'pagePath' },
      ],
      metrics: metrics || [
        { name: 'activeUsers' },
        { name: 'screenPageViews' },
        { name: 'sessions' },
      ],
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: response,
      }),
    };
  } catch (error) {
    console.error('Analytics error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch analytics data',
      }),
    };
  }
}
```

4. **Create Admin Analytics Dashboard**

```typescript
// frontend/src/pages/AdminAnalytics.tsx
import React, { useState, useEffect } from 'react';
import { adminApi } from '@/utils/api';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export const AdminAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30daysAgo');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAnalytics({
        startDate: dateRange,
        endDate: 'today',
      });
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Analytics Dashboard</h1>

      {/* Date Range Selector */}
      <div className="mb-6">
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border rounded"
        >
          <option value="7daysAgo">Last 7 Days</option>
          <option value="30daysAgo">Last 30 Days</option>
          <option value="90daysAgo">Last 90 Days</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Users"
          value={analytics?.totalUsers || 0}
          change="+12%"
        />
        <MetricCard
          title="Page Views"
          value={analytics?.pageViews || 0}
          change="+8%"
        />
        <MetricCard
          title="Affiliate Clicks"
          value={analytics?.affiliateClicks || 0}
          change="+15%"
        />
        <MetricCard
          title="Conversion Rate"
          value={`${analytics?.conversionRate || 0}%`}
          change="+3%"
        />
      </div>

      {/* Traffic Chart */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Traffic Over Time</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={analytics?.trafficData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="users" stroke="#8884d8" />
            <Line type="monotone" dataKey="pageViews" stroke="#82ca9d" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Top Products */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-semibold mb-4">Top Products</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={analytics?.topProducts || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="views" fill="#8884d8" />
            <Bar dataKey="clicks" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Pages */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Top Pages</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Page</th>
              <th className="text-right py-2">Views</th>
              <th className="text-right py-2">Avg. Time</th>
            </tr>
          </thead>
          <tbody>
            {analytics?.topPages?.map((page: any, index: number) => (
              <tr key={index} className="border-b">
                <td className="py-2">{page.path}</td>
                <td className="text-right">{page.views}</td>
                <td className="text-right">{page.avgTime}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string | number; change: string }> = ({
  title,
  value,
  change,
}) => (
  <div className="bg-white p-6 rounded-lg shadow">
    <h3 className="text-gray-500 text-sm mb-2">{title}</h3>
    <div className="flex items-end justify-between">
      <span className="text-3xl font-bold">{value}</span>
      <span className="text-green-500 text-sm">{change}</span>
    </div>
  </div>
);
```

---

## 🔥 Option 2: Custom Event Tracking with DynamoDB

### Why This Approach?
- ✅ Full control over data
- ✅ No third-party dependencies
- ✅ Can track custom business metrics
- ✅ Privacy-friendly (no external tracking)

### Implementation

#### Step 1: Create Analytics Table

```typescript
// infrastructure/lib/storage-stack.ts
// Add to StorageStack

this.analyticsTable = new dynamodb.Table(this, 'AnalyticsTable', {
  tableName: 'AnalyticsEvents',
  partitionKey: {
    name: 'eventType',
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: 'timestamp',
    type: dynamodb.AttributeType.STRING,
  },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl', // Auto-delete old events after 90 days
  stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
});

// GSI for querying by date
this.analyticsTable.addGlobalSecondaryIndex({
  indexName: 'date-index',
  partitionKey: {
    name: 'date',
    type: dynamodb.AttributeType.STRING,
  },
  sortKey: {
    name: 'timestamp',
    type: dynamodb.AttributeType.STRING,
  },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

#### Step 2: Create Event Tracking Lambda

```typescript
// backend/functions/trackEvent/index.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.ANALYTICS_TABLE_NAME || 'AnalyticsEvents';

export async function handler(event: any) {
  try {
    const { eventType, eventData, userId, sessionId } = JSON.parse(event.body || '{}');

    const timestamp = new Date().toISOString();
    const date = timestamp.split('T')[0];
    const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days

    const analyticsEvent = {
      eventId: uuidv4(),
      eventType,
      timestamp,
      date,
      ttl,
      userId: userId || 'anonymous',
      sessionId: sessionId || uuidv4(),
      ...eventData,
      // Extract useful info from request
      userAgent: event.headers?.['user-agent'],
      ipAddress: event.requestContext?.identity?.sourceIp,
      referer: event.headers?.referer,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: analyticsEvent,
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        eventId: analyticsEvent.eventId,
      }),
    };
  } catch (error) {
    console.error('Track event error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Failed to track event',
      }),
    };
  }
}
```

#### Step 3: Create Analytics Query Lambda

```typescript
// backend/functions/getAnalyticsSummary/index.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.REGION });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.ANALYTICS_TABLE_NAME || 'AnalyticsEvents';

export async function handler(event: any) {
  try {
    const { startDate, endDate } = event.queryStringParameters || {};

    // Query events by date range
    const events = await queryEventsByDateRange(startDate, endDate);

    // Calculate metrics
    const metrics = calculateMetrics(events);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        data: metrics,
      }),
    };
  } catch (error) {
    console.error('Get analytics error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Failed to fetch analytics',
      }),
    };
  }
}

async function queryEventsByDateRange(startDate: string, endDate: string) {
  // Implementation to query DynamoDB by date range
  // Use date-index GSI
}

function calculateMetrics(events: any[]) {
  const pageViews = events.filter(e => e.eventType === 'page_view').length;
  const productViews = events.filter(e => e.eventType === 'product_view').length;
  const affiliateClicks = events.filter(e => e.eventType === 'affiliate_click').length;
  const uniqueUsers = new Set(events.map(e => e.userId)).size;

  return {
    pageViews,
    productViews,
    affiliateClicks,
    uniqueUsers,
    conversionRate: affiliateClicks > 0 ? (affiliateClicks / productViews * 100).toFixed(2) : 0,
  };
}
```

#### Step 4: Frontend Tracking

```typescript
// frontend/src/utils/customAnalytics.ts
import { api } from './api';

let sessionId: string | null = null;

function getSessionId() {
  if (!sessionId) {
    sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('sessionId', sessionId);
    }
  }
  return sessionId;
}

export async function trackEvent(eventType: string, eventData: any = {}) {
  try {
    await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType,
        eventData,
        sessionId: getSessionId(),
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    console.error('Failed to track event:', error);
  }
}

export const trackPageView = (path: string) => {
  trackEvent('page_view', { path });
};

export const trackProductView = (productId: string, productName: string) => {
  trackEvent('product_view', { productId, productName });
};

export const trackAffiliateClick = (productId: string, productName: string) => {
  trackEvent('affiliate_click', { productId, productName });
};
```

---

## 📈 Option 3: Hybrid Approach (Best of Both Worlds)

Combine GA4 for standard web analytics with custom tracking for business-specific metrics:

1. **GA4**: User behavior, demographics, traffic sources
2. **Custom DynamoDB**: Product performance, affiliate clicks, conversion tracking
3. **CloudWatch**: API performance, error rates, Lambda metrics

### Benefits:
- Comprehensive analytics coverage
- Business-specific insights
- Infrastructure monitoring
- Redundancy and data validation

---

## 🚀 Quick Start: Minimal Implementation

If you want to start simple and expand later:

### Step 1: Add GA4 (5 minutes)

```bash
npm install react-ga4
```

```typescript
// Add to frontend/.env.local
VITE_GA_TRACKING_ID=G-XXXXXXXXXX
```

```typescript
// Add to App.tsx
import ReactGA from 'react-ga4';

useEffect(() => {
  ReactGA.initialize(import.meta.env.VITE_GA_TRACKING_ID);
}, []);
```

### Step 2: View in Google Analytics
- Real-time data available immediately
- Historical data builds over time
- No admin portal integration needed initially

### Step 3: Add Admin Portal Later
- Implement GA4 Reporting API when ready
- Or embed GA4 dashboard via iframe

---

## 📊 Metrics to Track

### Essential Metrics:
- Page views
- Unique visitors
- Session duration
- Bounce rate
- Traffic sources

### Business Metrics:
- Product views
- Affiliate link clicks
- Click-through rate (CTR)
- Top performing products
- Category performance

### Technical Metrics:
- API response times
- Error rates
- Lambda execution times
- Cache hit rates

---

## 💰 Cost Comparison

| Solution | Setup Cost | Monthly Cost | Complexity |
|----------|------------|--------------|------------|
| GA4 Only | Free | Free | Low |
| Custom DynamoDB | Dev time | $1-5 | Medium |
| Hybrid | Dev time | $1-5 | Medium-High |
| GA4 + Reporting API | Dev time | Free | Medium |

---

## 🎯 Recommendation

**Start with GA4** (Option 1) because:
1. Zero cost
2. Quick setup (< 30 minutes)
3. Industry-standard metrics
4. Can add custom tracking later
5. Powerful reporting out of the box

**Add custom tracking** (Option 2) when you need:
1. Business-specific metrics
2. Real-time admin dashboard
3. Custom conversion tracking
4. Privacy-focused analytics

---

## 📚 Next Steps

1. Choose your approach
2. Follow implementation guide
3. Test tracking in development
4. Deploy to production
5. Monitor and iterate

Would you like me to implement any of these options for you?
