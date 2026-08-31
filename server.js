import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import apiRoutes from "./routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Directory paths
const uploadsDir = path.join(__dirname, "uploads");
const frontendUploadsDir = path.join(__dirname, "..", "frontend", "public", "uploads");
const rootUploadsDir = path.join(__dirname, "..", "public", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(frontendUploadsDir)) {
  fs.mkdirSync(frontendUploadsDir, { recursive: true });
}

// Serve Static Assets & Uploads
app.use("/uploads", express.static(uploadsDir));
app.use("/uploads", express.static(frontendUploadsDir));
if (fs.existsSync(rootUploadsDir)) {
  app.use("/uploads", express.static(rootUploadsDir));
}
app.use("/src/assets", express.static(path.join(__dirname, "..", "frontend", "src", "assets")));
if (fs.existsSync(path.join(__dirname, "..", "src", "assets"))) {
  app.use("/src/assets", express.static(path.join(__dirname, "..", "src", "assets")));
}

// Mount API Routes (MVC Architecture with MongoDB Mongoose)
app.use("/api", apiRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", database: "MongoDB + Express MVC Server Running" });
});

app.listen(PORT, () => {
  console.log(`Node.js Express MVC Backend Server with MongoDB running at http://localhost:${PORT}`);
});
