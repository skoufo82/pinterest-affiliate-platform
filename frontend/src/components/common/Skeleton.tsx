interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

/**
 * Base Skeleton component for loading states
 */
export const Skeleton = ({ 
  className = '', 
  width, 
  height,
  rounded = 'md' 
}: SkeletonProps) => {
  const roundedClass = {
    none: '',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  }[rounded];

  return (
    <div
      className={`bg-gray-200 animate-pulse ${roundedClass} ${className}`}
      style={{ width, height }}
      role="status"
      aria-label="Loading..."
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

/**
 * Product Card Skeleton for loading product cards
 */
export const ProductCardSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Image skeleton */}
      <Skeleton className="w-full h-64" rounded="none" />
      
      <div className="p-4 space-y-3">
        {/* Title skeleton */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* Description skeleton - 2 lines */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        
        {/* Price skeleton */}
        <Skeleton className="h-5 w-20" />
        
        {/* Button skeleton */}
        <Skeleton className="h-10 w-full" rounded="lg" />
      </div>
    </div>
  );
};

/**
 * Category Card Skeleton for loading category cards
 */
export const CategoryCardSkeleton = () => {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Image skeleton */}
      <Skeleton className="w-full h-48" rounded="none" />
      
      <div className="p-4">
        {/* Category name skeleton */}
        <Skeleton className="h-6 w-2/3 mx-auto" />
      </div>
    </div>
  );
};

/**
 * Product Grid Skeleton for loading product grids
 */
export const ProductGridSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
};

/**
 * Table Row Skeleton for loading table rows
 */
export const TableRowSkeleton = ({ columns = 4 }: { columns?: number }) => {
  return (
    <tr className="border-b border-gray-200">
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-6 py-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
};

/**
 * Table Skeleton for loading tables
 */
export const TableSkeleton = ({ 
  rows = 5, 
  columns = 4 
}: { 
  rows?: number; 
  columns?: number; 
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="px-6 py-3">
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, index) => (
            <TableRowSkeleton key={index} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Text Skeleton for loading text content
 */
export const TextSkeleton = ({ 
  lines = 3,
  className = '' 
}: { 
  lines?: number;
  className?: string;
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton 
          key={index} 
          className="h-4"
          width={index === lines - 1 ? '80%' : '100%'}
        />
      ))}
    </div>
  );
};
