import Masonry from 'react-masonry-css';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  onProductClick?: (product: Product) => void;
}

export const ProductGrid = ({ products, onProductClick }: ProductGridProps) => {
  // Responsive breakpoints for masonry columns - optimized for mobile
  const breakpointColumns = {
    default: 4,  // Large Desktop: 4 columns
    1280: 3,     // Desktop: 3 columns
    1024: 3,     // Tablet: 3 columns
    768: 2,      // Small tablet: 2 columns
    640: 2       // Mobile: 2 columns (better than 1 for Pinterest-style)
  };

  return (
    <Masonry
      breakpointCols={breakpointColumns}
      className="flex -ml-4 w-auto"
      columnClassName="pl-4 bg-clip-padding"
    >
      {products.map((product) => (
        <div key={product.id} className="mb-4">
          <ProductCard
            product={product}
            onClick={onProductClick ? () => onProductClick(product) : undefined}
          />
        </div>
      ))}
    </Masonry>
  );
};
