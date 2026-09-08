import { apiClient } from './client';

export const uploadsApi = {
  getUploadSignature: async (params = {}) => {
    return apiClient.post('/uploads/signature', params);
  },
  registerMetadata: async (assetPayload) => {
    return apiClient.post('/uploads/metadata', assetPayload);
  },
  getAssetById: async (assetId) => {
    return apiClient.get(`/uploads/${assetId}`);
  },
  deleteAsset: async (assetId) => {
    return apiClient.delete(`/uploads/${assetId}`);
  },
  /**
   * Directly uploads image file or remote image URL to Cloudinary CDN using signed upload parameters
   * @param {File|Blob|string} fileOrUrl - Local File/Blob or remote image URL
   * @param {Object} signatureData - Signature data from getUploadSignature
   * @returns {Promise<Object>} Cloudinary upload response object containing public_id, secure_url, eager, format, etc.
   */
  uploadToCloudinary: async (fileOrUrl, signatureData) => {
    const { signature, timestamp, apiKey, cloudName, folder, eager } = signatureData;
    const formData = new FormData();
    formData.append('file', fileOrUrl);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    if (folder) formData.append('folder', folder);
    if (eager) formData.append('eager', eager);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMsg = data.error?.message || `Cloudinary upload failed with HTTP status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  },
};
