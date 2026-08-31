import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || process.env.API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.API_SECRET || "",
  secure: true,
});

export const isCloudinaryConfigured = () => {
  const config = cloudinary.config();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
};

/**
 * Uploads a local file path or buffer to Cloudinary
 * @param {string|Buffer} fileInput - Absolute path or Buffer to upload
 * @param {object} options - Custom Cloudinary upload options
 * @returns {Promise<{ url: string, public_id: string }>}
 */
export const uploadToCloudinary = (fileInput, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: "a2v_prints",
      resource_type: "auto",
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      ...options,
    };

    if (Buffer.isBuffer(fileInput)) {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url || result.url,
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
          });
        }
      );
      uploadStream.end(fileInput);
    } else {
      cloudinary.uploader
        .upload(fileInput, uploadOptions)
        .then((result) => {
          resolve({
            url: result.secure_url || result.url,
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes,
            width: result.width,
            height: result.height,
          });
        })
        .catch(reject);
    }
  });
};

export default cloudinary;
