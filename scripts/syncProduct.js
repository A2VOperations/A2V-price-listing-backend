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
    await mongoose.connect(mongoURI, { dbName: "A2V-Pricing" });
    console.log("Connected to MongoDB successfully!");

    const possiblePaths = [
      path.join(__dirname, "..", "data", "products.json"),
      path.join(
        __dirname,
        "..",
        "..",
        "frontend",
        "server",
        "data",
        "products.json",
      ),
    ];
    const productsPath = possiblePaths.find((p) => fs.existsSync(p));
    if (!productsPath) {
      throw new Error("Could not find products.json");
    }
    const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));

    const standees = products.filter((p) => p.subCategory === "STANDIE");
    for (const standee of standees) {
      const toUpdate = { ...standee };
      delete toUpdate._id;
      const result = await Product.findOneAndUpdate(
        { id: standee.id },
        { $set: toUpdate },
        { new: true, upsert: true },
      );
      console.log(
        `✅ Successfully updated ${standee.id} (${standee.name}) in MongoDB!`,
      );
    }

    // Clean up old STD-003
    await Product.deleteOne({ id: "STD-003" });
    console.log("✅ Successfully removed legacy STD-003 from MongoDB!");

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
    process.exit(0);
  } catch (err) {
    console.error("Error updating MongoDB:", err.message);
    process.exit(1);
  }
}

syncProduct();
