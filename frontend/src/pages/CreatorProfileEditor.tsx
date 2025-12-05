import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ImageUploader } from '@/components/admin/ImageUploader';
import { adminApi, creatorApi } from '@/utils/api';
import type { Creator } from '@/types';

interface CreatorProfileFormData {
  displayName: string;
  bio: string;
  profileImage: string;
  coverImage: string;
  socialLinks: {
    instagram: string;
    pinterest: string;
    tiktok: string;
  };
  theme: {
    primaryColor: string;
    accentColor: string;
    font: string;
  };
}

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter (Modern Sans-Serif)' },
  { value: 'Roboto', label: 'Roboto (Clean Sans-Serif)' },
  { value: 'Playfair Display', label: 'Playfair Display (Elegant Serif)' },
  { value: 'Lora', label: 'Lora (Classic Serif)' },
  { value: 'Montserrat', label: 'Montserrat (Geometric Sans-Serif)' },
  { value: 'Open Sans', label: 'Open Sans (Friendly Sans-Serif)' },
];

export const CreatorProfileEditor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [formData, setFormData] = useState<CreatorProfileFormData>({
    displayName: '',
    bio: '',
    profileImage: '',
    coverImage: '',
    socialLinks: {
      instagram: '',
      pinterest: '',
      tiktok: '',
    },
    theme: {
      primaryColor: '#ec4899',
      accentColor: '#8b5cf6',
      font: 'Inter',
    },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load creator profile on mount
  useEffect(() => {
    loadCreatorProfile();
  }, []);

  const loadCreatorProfile = async () => {
    try {
      setLoading(true);
      const response = await creatorApi.getProfile();
      setCreator(response.creator);
      setFormData({
        displayName: response.creator.displayName,
        bio: response.creator.bio,
        profileImage: response.creator.profileImage,
        coverImage: response.creator.coverImage,
        socialLinks: {
          instagram: response.creator.socialLinks.instagram || '',
          pinterest: response.creator.socialLinks.pinterest || '',
          tiktok: response.creator.socialLinks.tiktok || '',
        },
        theme: response.creator.theme,
      });
    } catch (error) {
      console.error('Failed to load creator profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Display name validation
    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    } else if (formData.displayName.length > 100) {
      newErrors.displayName = 'Display name must be less than 100 characters';
    }

    // Bio validation
    if (!formData.bio.trim()) {
      newErrors.bio = 'Bio is required';
    } else if (formData.bio.length > 500) {
      newErrors.bio = 'Bio must be less than 500 characters';
    }

    // Profile image validation
    if (!formData.profileImage) {
      newErrors.profileImage = 'Profile image is required';
    }

    // Cover image validation
    if (!formData.coverImage) {
      newErrors.coverImage = 'Cover image is required';
    }

    // Social links validation (optional but must be valid URLs if provided)
    const urlPattern = /^https?:\/\/.+/;
    if (formData.socialLinks.instagram && !urlPattern.test(formData.socialLinks.instagram)) {
      newErrors.instagram = 'Instagram link must be a valid URL';
    }
    if (formData.socialLinks.pinterest && !urlPattern.test(formData.socialLinks.pinterest)) {
      newErrors.pinterest = 'Pinterest link must be a valid URL';
    }
    if (formData.socialLinks.tiktok && !urlPattern.test(formData.socialLinks.tiktok)) {
      newErrors.tiktok = 'TikTok link must be a valid URL';
    }

    // Theme color validation (hex format)
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    if (!hexPattern.test(formData.theme.primaryColor)) {
      newErrors.primaryColor = 'Primary color must be a valid hex color (e.g., #ec4899)';
    }
    if (!hexPattern.test(formData.theme.accentColor)) {
      newErrors.accentColor = 'Accent color must be a valid hex color (e.g., #8b5cf6)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    try {
      setSaving(true);
      
      // Prepare data for submission, converting empty strings to undefined for optional fields
      const submitData = {
        displayName: formData.displayName,
        bio: formData.bio,
        profileImage: formData.profileImage,
        coverImage: formData.coverImage,
        socialLinks: {
          instagram: formData.socialLinks.instagram || undefined,
          pinterest: formData.socialLinks.pinterest || undefined,
          tiktok: formData.socialLinks.tiktok || undefined,
        },
        theme: formData.theme,
      };
      
      await creatorApi.updateProfile(submitData);
      toast.success('Profile updated successfully');
      
      // Navigate to creator's landing page
      if (creator?.slug) {
        navigate(`/creator/${creator.slug}`);
      }
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleProfileImageUpload = async (file: File): Promise<string | null> => {
    try {
      const response = await adminApi.uploadImage(file.name, file.type);
      await adminApi.uploadToS3(response.uploadUrl, file);
      setFormData((prev) => ({ ...prev, profileImage: response.imageUrl }));
      setErrors((prev) => ({ ...prev, profileImage: '' }));
      return response.imageUrl;
    } catch (error) {
      console.error('Failed to upload profile image:', error);
      toast.error('Failed to upload profile image');
      return null;
    }
  };

  const handleCoverImageUpload = async (file: File): Promise<string | null> => {
    try {
      const response = await adminApi.uploadImage(file.name, file.type);
      await adminApi.uploadToS3(response.uploadUrl, file);
      setFormData((prev) => ({ ...prev, coverImage: response.imageUrl }));
      setErrors((prev) => ({ ...prev, coverImage: '' }));
      return response.imageUrl;
    } catch (error) {
      console.error('Failed to upload cover image:', error);
      toast.error('Failed to upload cover image');
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
        <p className="mt-2 text-gray-600">
          Customize your creator profile and storefront appearance
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Basic Information</h2>

          {/* Display Name */}
          <div className="mb-6">
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
              Display Name *
            </label>
            <input
              type="text"
              id="displayName"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                errors.displayName ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={saving}
              maxLength={100}
              placeholder="Your display name"
            />
            {errors.displayName && <p className="mt-1 text-sm text-red-600">{errors.displayName}</p>}
            <p className="mt-1 text-xs text-gray-500">{formData.displayName.length}/100 characters</p>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
              Bio *
            </label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={4}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                errors.bio ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={saving}
              maxLength={500}
              placeholder="Tell visitors about yourself and your products..."
            />
            {errors.bio && <p className="mt-1 text-sm text-red-600">{errors.bio}</p>}
            <p className="mt-1 text-xs text-gray-500">{formData.bio.length}/500 characters</p>
          </div>
        </div>

        {/* Images Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Images</h2>

          {/* Profile Image */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile Image *
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Recommended: Square image, at least 400x400px
            </p>
            <ImageUploader
              onUpload={handleProfileImageUpload}
              currentImageUrl={formData.profileImage}
              disabled={saving}
            />
            {errors.profileImage && <p className="mt-1 text-sm text-red-600">{errors.profileImage}</p>}
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cover Image *
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Recommended: Wide image, at least 1200x400px
            </p>
            <ImageUploader
              onUpload={handleCoverImageUpload}
              currentImageUrl={formData.coverImage}
              disabled={saving}
            />
            {errors.coverImage && <p className="mt-1 text-sm text-red-600">{errors.coverImage}</p>}
          </div>
        </div>

        {/* Social Media Links Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Social Media Links</h2>
          <p className="text-sm text-gray-600 mb-6">
            Add links to your social media profiles (optional)
          </p>

          {/* Instagram */}
          <div className="mb-4">
            <label htmlFor="instagram" className="block text-sm font-medium text-gray-700 mb-1">
              Instagram
            </label>
            <input
              type="url"
              id="instagram"
              value={formData.socialLinks.instagram}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, instagram: e.target.value },
                })
              }
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                errors.instagram ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={saving}
              placeholder="https://instagram.com/yourusername"
            />
            {errors.instagram && <p className="mt-1 text-sm text-red-600">{errors.instagram}</p>}
          </div>

          {/* Pinterest */}
          <div className="mb-4">
            <label htmlFor="pinterest" className="block text-sm font-medium text-gray-700 mb-1">
              Pinterest
            </label>
            <input
              type="url"
              id="pinterest"
              value={formData.socialLinks.pinterest}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, pinterest: e.target.value },
                })
              }
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                errors.pinterest ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={saving}
              placeholder="https://pinterest.com/yourusername"
            />
            {errors.pinterest && <p className="mt-1 text-sm text-red-600">{errors.pinterest}</p>}
          </div>

          {/* TikTok */}
          <div>
            <label htmlFor="tiktok" className="block text-sm font-medium text-gray-700 mb-1">
              TikTok
            </label>
            <input
              type="url"
              id="tiktok"
              value={formData.socialLinks.tiktok}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, tiktok: e.target.value },
                })
              }
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                errors.tiktok ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={saving}
              placeholder="https://tiktok.com/@yourusername"
            />
            {errors.tiktok && <p className="mt-1 text-sm text-red-600">{errors.tiktok}</p>}
          </div>
        </div>

        {/* Theme Customization Section */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Theme Customization</h2>
          <p className="text-sm text-gray-600 mb-6">
            Customize the colors and font for your storefront
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Theme Controls */}
            <div className="space-y-4">
              {/* Primary Color */}
              <div>
                <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="primaryColor"
                    value={formData.theme.primaryColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, primaryColor: e.target.value },
                      })
                    }
                    className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                    disabled={saving}
                  />
                  <input
                    type="text"
                    value={formData.theme.primaryColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, primaryColor: e.target.value },
                      })
                    }
                    className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                      errors.primaryColor ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={saving}
                    placeholder="#ec4899"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
                {errors.primaryColor && <p className="mt-1 text-sm text-red-600">{errors.primaryColor}</p>}
                <p className="mt-1 text-xs text-gray-500">Used for buttons and primary elements</p>
              </div>

              {/* Accent Color */}
              <div>
                <label htmlFor="accentColor" className="block text-sm font-medium text-gray-700 mb-1">
                  Accent Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    id="accentColor"
                    value={formData.theme.accentColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, accentColor: e.target.value },
                      })
                    }
                    className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                    disabled={saving}
                  />
                  <input
                    type="text"
                    value={formData.theme.accentColor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        theme: { ...formData.theme, accentColor: e.target.value },
                      })
                    }
                    className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                      errors.accentColor ? 'border-red-500' : 'border-gray-300'
                    }`}
                    disabled={saving}
                    placeholder="#8b5cf6"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
                {errors.accentColor && <p className="mt-1 text-sm text-red-600">{errors.accentColor}</p>}
                <p className="mt-1 text-xs text-gray-500">Used for highlights and secondary elements</p>
              </div>

              {/* Font Selection */}
              <div>
                <label htmlFor="font" className="block text-sm font-medium text-gray-700 mb-1">
                  Font
                </label>
                <select
                  id="font"
                  value={formData.theme.font}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      theme: { ...formData.theme, font: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  disabled={saving}
                >
                  {FONT_OPTIONS.map((font) => (
                    <option key={font.value} value={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Font family for your storefront</p>
              </div>
            </div>

            {/* Live Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Live Preview
              </label>
              <div
                className="border-2 border-gray-200 rounded-lg p-6 space-y-4"
                style={{ fontFamily: formData.theme.font }}
              >
                <h3
                  className="text-2xl font-bold"
                  style={{ color: formData.theme.primaryColor }}
                >
                  Your Storefront
                </h3>
                <p className="text-gray-600">
                  This is how your storefront will look with your selected theme.
                </p>
                <button
                  type="button"
                  className="px-4 py-2 rounded-md text-white font-medium"
                  style={{ backgroundColor: formData.theme.primaryColor }}
                >
                  Primary Button
                </button>
                <button
                  type="button"
                  className="ml-2 px-4 py-2 rounded-md text-white font-medium"
                  style={{ backgroundColor: formData.theme.accentColor }}
                >
                  Accent Button
                </button>
                <div className="mt-4 p-4 rounded-md" style={{ backgroundColor: `${formData.theme.primaryColor}20` }}>
                  <p style={{ color: formData.theme.primaryColor }} className="font-medium">
                    Featured Product
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    This is how featured items will appear
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-pink-600 text-white px-6 py-3 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={saving}
            className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatorProfileEditor;
