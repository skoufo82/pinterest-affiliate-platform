import { useEffect, useState } from 'react';
import { adminApi } from '@/utils/api';
import toast from 'react-hot-toast';

interface SyncError {
  productId: string;
  asin: string;
  errorMessage: string;
  errorCode: string;
}

interface SyncExecution {
  executionId: string;
  startTime: string;
  endTime: string;
  duration: number;
  totalProducts: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  status: 'success' | 'partial' | 'failed';
  errors?: SyncError[];
}

interface SyncHistoryResponse {
  executions: SyncExecution[];
  count: number;
  filters: {
    startDate: string;
    endDate: string;
    status?: string;
  };
}

function AdminSyncHistory() {
  const [executions, setExecutions] = useState<SyncExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'partial' | 'failed'>('all');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchSyncHistory = async () => {
    setLoading(true);
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (dateRange) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
      }

      const params: any = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 50,
      };

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response: SyncHistoryResponse = await adminApi.getSyncHistory(params);
      setExecutions(response.executions || []);
    } catch (error) {
      console.error('Failed to fetch sync history:', error);
      toast.error('Failed to load sync history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncHistory();
  }, [statusFilter, dateRange]);

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      await adminApi.triggerPriceSync();
      toast.success('Price sync triggered successfully');
      // Refresh history after a short delay
      setTimeout(() => {
        fetchSyncHistory();
      }, 2000);
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      toast.error('Failed to trigger price sync');
    } finally {
      setSyncing(false);
    }
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const formatDate = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Success</span>;
      case 'partial':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Partial</span>;
      case 'failed':
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Failed</span>;
      default:
        return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const toggleExpanded = (executionId: string) => {
    setExpandedExecution(expandedExecution === executionId ? null : executionId);
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Price Sync History</h1>
          <p className="text-sm sm:text-base text-gray-600">View execution logs and sync status</p>
        </div>
        <button
          onClick={handleTriggerSync}
          disabled={syncing}
          className="mt-4 sm:mt-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? 'Syncing...' : 'Trigger Sync Now'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date Range
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as '7d' | '30d' | '90d')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'success' | 'partial' | 'failed')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All statuses</option>
              <option value="success">Success only</option>
              <option value="partial">Partial only</option>
              <option value="failed">Failed only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Execution List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Loading sync history...</p>
          </div>
        ) : executions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No sync executions found for the selected filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {executions.map((execution) => (
              <div key={execution.executionId} className="p-4 hover:bg-gray-50 transition-colors">
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between cursor-pointer"
                  onClick={() => toggleExpanded(execution.executionId)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusBadge(execution.status)}
                      <span className="text-sm text-gray-500">
                        {formatDate(execution.startTime)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-1 font-medium">{formatDuration(execution.duration)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total:</span>
                        <span className="ml-1 font-medium">{execution.totalProducts}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Success:</span>
                        <span className="ml-1 font-medium text-green-600">{execution.successCount}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Failed:</span>
                        <span className="ml-1 font-medium text-red-600">{execution.failureCount}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedExecution === execution.executionId ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedExecution === execution.executionId && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-500">Execution ID</p>
                        <p className="text-sm font-mono text-gray-900 break-all">{execution.executionId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Skipped Products</p>
                        <p className="text-sm font-medium text-gray-900">{execution.skippedCount}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Start Time</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(execution.startTime)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">End Time</p>
                        <p className="text-sm font-medium text-gray-900">{formatDate(execution.endTime)}</p>
                      </div>
                    </div>

                    {/* Error Details */}
                    {execution.errors && execution.errors.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">
                          Errors ({execution.errors.length})
                        </h4>
                        <div className="bg-red-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                          <div className="space-y-2">
                            {execution.errors.map((error, index) => (
                              <div key={index} className="text-sm">
                                <div className="flex items-start gap-2">
                                  <span className="font-mono text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                    {error.errorCode}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">
                                      Product: {error.productId}
                                    </p>
                                    <p className="text-gray-600">ASIN: {error.asin}</p>
                                    <p className="text-red-700 mt-1">{error.errorMessage}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminSyncHistory;
