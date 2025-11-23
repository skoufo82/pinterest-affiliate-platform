import Masonry from 'react-masonry-css';
import { Product } from '../../types';
import { ProductCard } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  onProductClick?: (product: Product) => void;
}

export const ProductGrid = ({ products, onProductClick }: ProductGridProps) => {
  // Responsive breakpoints for masonry columns
  const breakpointColumns = {
    default: 3,  // Desktop: 3 columns
    1024: 2,     // Tablet: 2 columns
    640: 1       // Mobile: 1 column
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
