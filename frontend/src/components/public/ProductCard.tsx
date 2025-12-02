import { Link } from 'react-router-dom';
import { Product } from '../../types';
import { LazyImage } from './LazyImage';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
}

export const ProductCard = ({ product, onClick }: ProductCardProps) => {
  const handleShopNowClick = (e: React.MouseEvent) => {
    // Prevent triggering navigation
    e.preventDefault();
    e.stopPropagation();
    // Open Amazon link in new tab
    window.open(product.amazonLink, '_blank', 'noopener,noreferrer');
  };

  // If onClick is provided, use the old modal behavior, otherwise link to product page
  const CardWrapper = onClick ? 'article' : Link;
  const wrapperProps = onClick
    ? {
        className: "bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer block group",
        onClick,
        role: "button" as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if ((e.key === 'Enter' || e.key === ' ') && onClick) {
            e.preventDefault();
            onClick();
          }
        },
        'aria-label': `View details for ${product.title}`,
      }
    : {
        to: `/products/${product.id}`,
        className: "bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 cursor-pointer block group",
        'aria-label': `View details for ${product.title}`,
      };

  return (
    <CardWrapper {...wrapperProps as any}>
      {/* Product Image */}
      <div className="relative overflow-hidden bg-gray-100">
        <LazyImage
          src={product.imageUrl}
          alt={product.title}
          className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>

      {/* Product Info */}
      <div className="p-4 sm:p-5">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2 line-clamp-2 leading-snug">
          {product.title}
        </h3>
        
        <p className="text-gray-600 text-sm mb-3 line-clamp-2 leading-relaxed">
          {product.description}
        </p>

        {/* Price (conditional) */}
        {product.price && (
          <div className="text-xl sm:text-2xl font-bold text-pink-600 mb-4" aria-label={`Price: ${product.price}`}>
            {product.price}
          </div>
        )}

        {/* Shop Now Button - Enhanced for mobile */}
        <button
          onClick={handleShopNowClick}
          className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold py-3 sm:py-3.5 px-4 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 shadow-md hover:shadow-lg active:scale-95"
          aria-label={`Shop now for ${product.title} on Amazon`}
        >
          Shop Now
        </button>
      </div>
    </CardWrapper>
  );
};
