import { Product } from '@/types';

interface ShareButtonProps {
  product: Product;
  className?: string;
}

/**
 * ShareButton component for sharing products on Pinterest
 * Generates Pinterest share URL with product image and description
 */
export const ShareButton = ({ product, className = '' }: ShareButtonProps) => {
  const handleShare = () => {
    // Generate Pinterest share URL
    // Pinterest URL format: https://pinterest.com/pin/create/button/?url=...&media=...&description=...
    const pinterestUrl = new URL('https://pinterest.com/pin/create/button/');
    
    // Add parameters
    pinterestUrl.searchParams.append('url', window.location.href);
    pinterestUrl.searchParams.append('media', product.imageUrl);
    pinterestUrl.searchParams.append('description', `${product.title} - ${product.description}`);

    // Open Pinterest in new window with specific dimensions
    const width = 750;
    const height = 550;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    window.open(
      pinterestUrl.toString(),
      'pinterest-share',
      `width=${width},height=${height},left=${left},top=${top},toolbar=0,menubar=0,location=0,status=0,scrollbars=1,resizable=1`
    );
  };

  return (
    <button
      onClick={handleShare}
      className={`inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${className}`}
      aria-label={`Share ${product.title} on Pinterest`}
    >
      {/* Pinterest Icon */}
      <svg
        className="w-5 h-5"
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
      </svg>
      <span>Share on Pinterest</span>
    </button>
  );
};
