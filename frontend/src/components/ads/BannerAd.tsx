import { AdSenseAd } from './AdSenseAd';

export const BannerAd: React.FC = () => {
  return (
    <div className="w-full my-6">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 max-w-7xl mx-auto">
        <p className="text-xs text-gray-500 text-center mb-2">Advertisement</p>
        <AdSenseAd
          adSlot="YOUR_BANNER_AD_SLOT" // Replace with actual ad slot from AdSense
          adFormat="horizontal"
          style={{ minHeight: '90px' }}
        />
      </div>
    </div>
  );
};
