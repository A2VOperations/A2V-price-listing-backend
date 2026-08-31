import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directories exist
const backendUploadsDir = path.join(__dirname, "..", "uploads");
const frontendUploadsDir = path.join(__dirname, "..", "..", "frontend", "public", "uploads");
const rootUploadsDir = path.join(__dirname, "..", "..", "public", "uploads");

[backendUploadsDir, frontendUploadsDir, rootUploadsDir].forEach((dir) => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
    // ignore
  }
});

// Configure Cloudinary if environment variables are provided
const hasCloudinary =
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET;

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Upload a single file buffer to Cloudinary or local disk
async function saveFile(file) {
  const ext = path.extname(file.originalname || "image.png") || ".png";
  const uniqueName = `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  // Always write a local copy to ensure immediate availability
  try {
    const localPathBackend = path.join(backendUploadsDir, uniqueName);
    fs.writeFileSync(localPathBackend, file.buffer);

    const localPathFrontend = path.join(frontendUploadsDir, uniqueName);
    fs.writeFileSync(localPathFrontend, file.buffer);
  } catch (localErr) {
    console.warn("Local disk write error:", localErr.message);
  }

  // If Cloudinary configured, attempt to upload to Cloudinary
  if (hasCloudinary) {
    try {
      const cloudinaryResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "a2v_price_listing", resource_type: "auto" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      if (cloudinaryResult && cloudinaryResult.secure_url) {
        return cloudinaryResult.secure_url;
      }
    } catch (cldErr) {
      console.warn("Cloudinary upload failed, using local URL:", cldErr.message);
    }
  }

  // Fallback to local URL path
  return `/uploads/${uniqueName}`;
}

// Controller for POST /api/upload
export async function uploadImages(req, res) {
  try {
    const files = req.files || (req.file ? [req.file] : []);

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded." });
    }

    const uploadPromises = files.map((file) => saveFile(file));
    const urls = await Promise.all(uploadPromises);

    return res.json({
      success: true,
      url: urls[0],
      urls: urls,
    });
  } catch (error) {
    console.error("Upload controller error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to process image upload.",
    });
  }
}
