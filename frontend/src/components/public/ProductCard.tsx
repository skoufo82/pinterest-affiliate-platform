import { Product } from '../../types';
import { LazyImage } from './LazyImage';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
}

export const ProductCard = ({ product, onClick }: ProductCardProps) => {
  const handleShopNowClick = (e: React.MouseEvent) => {
    // Prevent triggering onClick if it exists
    e.stopPropagation();
    // Open Amazon link in new tab
    window.open(product.amazonLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <article
      className="bg-white rounded-lg shadow-md overflow-hidden transition-transform duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`View details for ${product.title}`}
    >
      {/* Product Image */}
      <div className="relative overflow-hidden">
        <LazyImage
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-auto object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
          {product.title}
        </h3>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-3">
          {product.description}
        </p>

        {/* Price (conditional) */}
        {product.price && (
          <div className="text-xl font-bold text-pink-600 mb-3" aria-label={`Price: ${product.price}`}>
            {product.price}
          </div>
        )}

        {/* Shop Now Button */}
        <button
          onClick={handleShopNowClick}
          className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2"
          aria-label={`Shop now for ${product.title} on Amazon`}
        >
          Shop Now
        </button>
      </div>
    </article>
  );
};
