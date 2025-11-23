import { Category } from '../../types';
import { LazyImage } from './LazyImage';

interface CategoryCardProps {
  category: Category;
  onClick: () => void;
}

export const CategoryCard = ({ category, onClick }: CategoryCardProps) => {
  return (
    <article
      onClick={onClick}
      className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer transition-transform duration-300 hover:shadow-xl hover:-translate-y-1"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Browse ${category.name} category`}
    >
      {/* Category Image */}
      <div className="relative overflow-hidden h-48">
        {category.imageUrl ? (
          <LazyImage
            src={category.imageUrl}
            alt={`${category.name} category`}
            className="w-full h-full object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center" aria-hidden="true">
            <span className="text-white text-4xl font-bold">
              {category.name.charAt(0)}
            </span>
          </div>
        )}
      </div>

      {/* Category Name */}
      <div className="p-4">
        <h3 className="text-xl font-semibold text-gray-900 text-center">
          {category.name}
        </h3>
        {category.description && (
          <p className="text-gray-600 text-sm text-center mt-2">
            {category.description}
          </p>
        )}
      </div>
    </article>
  );
};
