import { AdSenseAd } from './AdSenseAd';

export const InFeedAd: React.FC = () => {
  return (
    <div className="w-full my-8">
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-xs text-gray-500 text-center mb-2">Advertisement</p>
        <AdSenseAd
          adSlot="YOUR_INFEED_AD_SLOT" // Replace with actual ad slot from AdSense
          adFormat="fluid"
          style={{ minHeight: '200px' }}
        />
      </div>
    </div>
  );
};
