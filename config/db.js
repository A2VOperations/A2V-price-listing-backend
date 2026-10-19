import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Category from "../models/Category.js";
import Product from "../models/Product.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function connectDB() {
  const cloudURI = process.env.MONGODB_URI;
  const localURI = "mongodb://127.0.0.1:27017/a2v_prints";

  if (cloudURI) {
    try {
      const conn = await mongoose.connect(cloudURI, { serverSelectionTimeoutMS: 3000 });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      await seedInitialData();
      return;
    } catch (error) {
      console.warn(`⚠️ Cloud MongoDB Error (${error.message}). Falling back to local MongoDB...`);
    }
  }

  try {
    const conn = await mongoose.connect(localURI, { serverSelectionTimeoutMS: 3000 });
    console.log(`✅ Local MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    await seedInitialData();
  } catch (localError) {
    console.error(`❌ Local MongoDB Connection Error: ${localError.message}`);
    console.log("⚠️ Continuing with local JSON file fallback operations.");
  }
}

async function seedInitialData() {
  try {
    const catCount = await Category.countDocuments();
    const categoriesPath = path.join(__dirname, "..", "data", "categories.json");
    if (fs.existsSync(categoriesPath)) {
      const categories = JSON.parse(fs.readFileSync(categoriesPath, "utf8"));
      if (Array.isArray(categories) && categories.length > 0) {
        if (catCount === 0) {
          await Category.insertMany(categories);
          console.log(`📦 Seeded ${categories.length} initial categories into MongoDB.`);
        } else {
          for (const cat of categories) {
            await Category.updateOne({ id: cat.id }, { $set: cat });
          }
        }
      }
    }

    const prodCount = await Product.countDocuments();
    const productsPath = path.join(__dirname, "..", "data", "products.json");
    if (fs.existsSync(productsPath)) {
      const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
      if (Array.isArray(products) && products.length > 0) {
        if (prodCount === 0) {
          await Product.insertMany(products);
          console.log(`📦 Seeded ${products.length} initial products into MongoDB.`);
        } else {
          for (const prod of products) {
            const exists = await Product.exists({ id: prod.id });
            if (!exists) {
              const toInsert = { ...prod };
              if (toInsert._id) {
                toInsert._id = new mongoose.Types.ObjectId(toInsert._id);
              }
              await Product.create(toInsert);
              console.log(`📦 Auto-synced product: ${prod.id} (${prod.name})`);
            } else if (prod.id === "STD-001" || prod.id === "STD-002" || prod.isStandie) {
              const toUpdate = { ...prod };
              delete toUpdate._id;
              await Product.updateOne({ id: prod.id }, { $set: toUpdate });
              console.log(`📦 Updated product in MongoDB: ${prod.id} (${prod.name})`);
            }
          }
          // Remove legacy STD-003 now that Iron Frame Standee is renumbered to STD-002
          await Product.deleteOne({ id: "STD-003" });
        }
      }
    }
  } catch (seedErr) {
    console.warn("⚠️ Initial seeding note:", seedErr.message);
  }
}
