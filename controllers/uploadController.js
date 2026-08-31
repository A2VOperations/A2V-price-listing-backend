import { uploadBufferToCloudinary, isCloudinaryConfigured } from "../config/cloudinary.js";

/**
 * Controller for POST /api/upload
 * Directly streams uploaded files to Cloudinary without saving anything to the local disk.
 */
export async function uploadImages(req, res) {
  try {
    const files = req.files || (req.file ? [req.file] : []);

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No file provided for upload.",
      });
    }

    if (!isCloudinaryConfigured()) {
      return res.status(500).json({
        success: false,
        message:
          "Cloudinary credentials missing. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env",
      });
    }

    // Upload all files directly to Cloudinary via streams in parallel
    const uploadPromises = files.map(async (file) => {
      const result = await uploadBufferToCloudinary(file.buffer, {
        folder: "a2v_price_listing",
        resource_type: "image",
      });
      return result.secure_url;
    });

    const urls = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      message: "Image(s) uploaded successfully to Cloudinary.",
      url: urls[0],
      urls: urls,
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload image to Cloudinary.",
    });
  }
}
