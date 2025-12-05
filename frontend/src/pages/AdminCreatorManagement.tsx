import { useEffect, useState } from 'react';
import { adminApi } from '@/utils/api';
import { Creator } from '@/types';
import { TableSkeleton } from '@/components/common';
import toast from 'react-hot-toast';

interface CreatorStats {
  productCount: number;
  approvedProducts: number;
  pendingProducts: number;
  pageViews: number;
  affiliateClicks: number;
}

function AdminCreatorManagement() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [creatorStats, setCreatorStats] = useState<Record<string, CreatorStats>>({});

  useEffect(() => {
    fetchCreators();
  }, []);

  const fetchCreators = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getAllCreators();
      setCreators(response.creators);
      
      // In a real implementation, we would fetch stats for each creator
      // For now, we'll use placeholder data
      const stats: Record<string, CreatorStats> = {};
      response.creators.forEach(creator => {
        stats[creator.id] = {
          productCount: 0,
          approvedProducts: 0,
          pendingProducts: 0,
          pageViews: 0,
          affiliateClicks: 0,
        };
      });
      setCreatorStats(stats);
    } catch (error) {
      console.error('Failed to fetch creators:', error);
      toast.error('Failed to load creators');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (creator: Creator) => {
    const newStatus = creator.status === 'active' ? 'disabled' : 'active';
    const action = newStatus === 'active' ? 'enable' : 'disable';
    
    if (!confirm(`Are you sure you want to ${action} ${creator.displayName}?`)) {
      return;
    }

    try {
      setActionLoading(creator.id);
      await adminApi.updateCreatorStatus(creator.id, newStatus);
      toast.success(`Creator ${action}d successfully`);
      
      // Update local state
      setCreators(creators.map(c => 
        c.id === creator.id ? { ...c, status: newStatus } : c
      ));
    } catch (error) {
      console.error('Failed to update creator status:', error);
      toast.error(`Failed to ${action} creator`);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6">Creator Management</h1>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <TableSkeleton rows={5} columns={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Creator Management</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Manage all creators on the platform ({creators.length} total)
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Total Creators</h3>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{creators.length}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Active</h3>
          <p className="text-2xl sm:text-3xl font-bold text-green-600">
            {creators.filter(c => c.status === 'active').length}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">Disabled</h3>
          <p className="text-2xl sm:text-3xl font-bold text-red-600">
            {creators.filter(c => c.status === 'disabled').length}
          </p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-xs sm:text-sm font-medium mb-2">New This Month</h3>
          <p className="text-2xl sm:text-3xl font-bold text-blue-600">
            {creators.filter(c => {
              const createdDate = new Date(c.createdAt);
              const now = new Date();
              return createdDate.getMonth() === now.getMonth() && 
                     createdDate.getFullYear() === now.getFullYear();
            }).length}
          </p>
        </div>
      </div>

      {/* Creators Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creator
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Slug
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statistics
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {creators.map((creator) => {
                const stats = creatorStats[creator.id] || {
                  productCount: 0,
                  approvedProducts: 0,
                  pendingProducts: 0,
                  pageViews: 0,
                  affiliateClicks: 0,
                };

                return (
                  <tr key={creator.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={creator.profileImage}
                          alt={creator.displayName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {creator.displayName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {creator.userId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={`/creator/${creator.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        /{creator.slug}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          creator.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {creator.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        <div>Products: {stats.productCount}</div>
                        <div className="text-gray-500">
                          Views: {stats.pageViews} | Clicks: {stats.affiliateClicks}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(creator.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleToggleStatus(creator)}
                        disabled={actionLoading === creator.id}
                        className={`px-3 py-1 rounded-md focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          creator.status === 'active'
                            ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500'
                            : 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-500'
                        }`}
                      >
                        {actionLoading === creator.id
                          ? 'Processing...'
                          : creator.status === 'active'
                          ? 'Disable'
                          : 'Enable'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {creators.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No creators found</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminCreatorManagement;
