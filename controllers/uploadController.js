import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { isCloudinaryConfigured, uploadToCloudinary } from "../config/cloudinary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendUploadsDir = path.join(__dirname, "..", "uploads");
const frontendUploadsDir = path.join(__dirname, "..", "..", "frontend", "public", "uploads");

// Helper to save a file buffer to disk
const saveLocalFile = (file) => {
  const ext = path.extname(file.originalname || "image.jpg") || ".jpg";
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const filename = `upload-${uniqueSuffix}${ext}`;
  const filePath = path.join(backendUploadsDir, filename);

  if (!fs.existsSync(backendUploadsDir)) {
    fs.mkdirSync(backendUploadsDir, { recursive: true });
  }

  // Handle both buffer storage (multer.memoryStorage) and disk storage fallback
  if (file.buffer) {
    fs.writeFileSync(filePath, file.buffer);
  } else if (file.path && fs.existsSync(file.path)) {
    fs.copyFileSync(file.path, filePath);
  }

  // Also sync to frontend/public/uploads if it exists
  try {
    if (!fs.existsSync(frontendUploadsDir)) {
      fs.mkdirSync(frontendUploadsDir, { recursive: true });
    }
    if (file.buffer) {
      fs.writeFileSync(path.join(frontendUploadsDir, filename), file.buffer);
    } else if (file.path && fs.existsSync(file.path)) {
      fs.copyFileSync(file.path, path.join(frontendUploadsDir, filename));
    }
  } catch (err) {
    console.warn("Could not copy uploaded image to frontend/public/uploads:", err.message);
  }

  return `/uploads/${filename}`;
};

export const uploadImages = async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const useCloudinary = isCloudinaryConfigured();
    const uploadedUrls = [];

    for (const file of files) {
      if (useCloudinary) {
        try {
          const fileData = file.buffer || file.path;
          const result = await uploadToCloudinary(fileData, {
            folder: "a2v_prints",
          });
          uploadedUrls.push(result.url);
        } catch (cloudErr) {
          console.warn("Cloudinary upload failed, falling back to local storage:", cloudErr.message);
          const localUrl = saveLocalFile(file);
          uploadedUrls.push(localUrl);
        }
      } else {
        const localUrl = saveLocalFile(file);
        uploadedUrls.push(localUrl);
      }
    }

    return res.json({
      success: true,
      url: uploadedUrls[0] || "",
      urls: uploadedUrls,
      count: uploadedUrls.length,
    });
  } catch (error) {
    console.error("Upload controller error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to upload image(s)" });
  }
};

export const uploadImage = uploadImages;
