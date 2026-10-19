import "dotenv/config";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Product from "../models/Product.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function syncProduct() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error("No MONGODB_URI found in .env");
    process.exit(1);
  }

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB successfully!");

    const productsPath = path.join(__dirname, "..", "data", "products.json");
    const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));

    const std002 = products.find((p) => p.id === "STD-002");
    if (!std002) {
      console.error("STD-002 not found in backend/data/products.json");
      process.exit(1);
    }

    const toUpdate = { ...std002 };
    delete toUpdate._id;

    const result = await Product.findOneAndUpdate(
      { id: "STD-002" },
      { $set: toUpdate },
      { new: true, upsert: true }
    );

    console.log("✅ Successfully updated STD-002 in MongoDB database!");
    console.log("Name:", result.name);
    console.log("Fixed Widths:", result.fixedWidths);
    console.log("Standee Size:", result.standeeSize);
    console.log("Base Price:", result.basePrice);
    console.log("Variants Count:", result.variantCombinations?.length);

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  } catch (err) {
    console.error("Error updating MongoDB:", err.message);
    process.exit(1);
  }
}

syncProduct();
