import { useEffect, useState } from 'react';
import { adminApi } from '@/utils/api';
import { PlatformAnalyticsResponse } from '@/types';
import { TableSkeleton } from '@/components/common';
import toast from 'react-hot-toast';

function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<PlatformAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getPlatformAnalytics();
      setAnalytics(response);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6">Platform Analytics</h1>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <TableSkeleton rows={5} columns={4} />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6">Platform Analytics</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 text-lg">No analytics data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Platform Analytics</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Overview of platform-wide metrics and performance
        </p>
      </div>

      {/* Platform Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Creators</h3>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{analytics.totalCreators}</p>
          <p className="text-xs text-gray-500 mt-1">
            {analytics.activeCreators} active
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Products</h3>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{analytics.totalProducts}</p>
          <p className="text-xs text-gray-500 mt-1">
            {analytics.approvedProducts} approved
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Page Views</h3>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">
            {analytics.totalPageViews.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Affiliate Clicks</h3>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">
            {analytics.totalAffiliateClicks.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Product Approval Statistics */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Product Approval Statistics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">{analytics.pendingProducts}</p>
            <p className="text-sm text-gray-600 mt-1">Pending Review</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{analytics.approvedProducts}</p>
            <p className="text-sm text-gray-600 mt-1">Approved</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-3xl font-bold text-red-600">{analytics.rejectedProducts}</p>
            <p className="text-sm text-gray-600 mt-1">Rejected</p>
          </div>
        </div>
      </div>

      {/* Creator Leaderboard */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Top Creators</h2>
          <p className="text-sm text-gray-600 mt-1">Ranked by page views and engagement</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Products
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Page Views
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clicks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CTR
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {analytics.topCreators.map((creator, index) => {
                const ctr = creator.pageViews > 0 
                  ? ((creator.affiliateClicks / creator.pageViews) * 100).toFixed(2)
                  : '0.00';

                return (
                  <tr key={creator.creatorId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-semibold">
                        {index + 1}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {creator.displayName}
                      </div>
                      <a
                        href={`/creator/${creator.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        /{creator.slug}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {creator.productCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {creator.pageViews.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {creator.affiliateClicks.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {ctr}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {analytics.topCreators.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No creator data available</p>
          </div>
        )}
      </div>

      {/* Recent Approvals */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Recent Approvals</h2>
          <p className="text-sm text-gray-600 mt-1">Latest products approved by admins</p>
        </div>
        <div className="p-6">
          {analytics.recentApprovals.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent approvals</p>
          ) : (
            <div className="space-y-3">
              {analytics.recentApprovals.map((approval) => (
                <div
                  key={approval.productId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <h3 className="font-medium text-gray-900">{approval.title}</h3>
                    <p className="text-sm text-gray-500">by {approval.creatorName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">
                      {new Date(approval.approvedAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(approval.approvedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminAnalytics;
