import { AdSenseAd } from './AdSenseAd';

export const SidebarAd: React.FC = () => {
  return (
    <div className="sticky top-24 mb-6">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-xs text-gray-500 text-center mb-2">Advertisement</p>
        <AdSenseAd
          adSlot="YOUR_SIDEBAR_AD_SLOT" // Replace with actual ad slot from AdSense
          adFormat="rectangle"
          style={{ minHeight: '250px', minWidth: '300px' }}
        />
      </div>
    </div>
  );
};
