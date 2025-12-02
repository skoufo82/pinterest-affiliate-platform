import { AdSenseAd } from './AdSenseAd';

export const BannerAd: React.FC = () => {
  return (
    <div className="w-full my-4 md:my-6">
      <div className="bg-gray-50 rounded-lg p-2 md:p-4 border border-gray-200 max-w-7xl mx-auto">
        <p className="text-xs text-gray-500 text-center mb-1 md:mb-2">Advertisement</p>
        <AdSenseAd
          adSlot="1607763542"
          adFormat="horizontal"
          style={{ minHeight: '50px', maxHeight: '100px' }}
        />
      </div>
    </div>
  );
};
