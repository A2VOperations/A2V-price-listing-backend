import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function updateDatabase() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI || !mongoURI.includes("mongodb")) {
    console.error("❌ No MONGODB_URI found in environment variables.");
    process.exit(1);
  }

  const targets = [{ name: "Cloud MongoDB Atlas (A2V-Pricing)", uri: mongoURI }];

  const productsPath = path.join(__dirname, "..", "data", "products.json");
  const categoriesPath = path.join(__dirname, "..", "data", "categories.json");

  const products = JSON.parse(fs.readFileSync(productsPath, "utf8"));
  const categories = JSON.parse(fs.readFileSync(categoriesPath, "utf8"));

  for (const target of targets) {
    console.log(`\n========================================`);
    console.log(`Connecting to: ${target.name}...`);
    try {
      const conn = await mongoose.createConnection(target.uri, {
        serverSelectionTimeoutMS: 5000,
        dbName: "A2V-Pricing",
      }).asPromise();

      console.log(`✅ Connected to ${target.name}!`);
      const Product = conn.collection("products");
      const Category = conn.collection("categories");

      // Delete all old STANDIE products to ensure clean renumbering
      const delResult = await Product.deleteMany({
        $or: [
          { subCategory: "STANDIE" },
          { id: { $in: ["STD-001", "STD-002", "STD-003", "STD-004", "STD-005"] } },
        ],
      });
      console.log(`🗑️ Removed ${delResult.deletedCount} old standee products.`);

      // Upsert all products from products.json
      let updatedCount = 0;
      for (const prod of products) {
        const toSet = { ...prod };
        delete toSet._id;
        await Product.updateOne(
          { id: prod.id },
          { $set: toSet },
          { upsert: true }
        );
        updatedCount++;
      }
      console.log(`📦 Upserted ${updatedCount} products into database.`);

      // Upsert categories
      for (const cat of categories) {
        const toSet = { ...cat };
        delete toSet._id;
        await Category.updateOne(
          { id: cat.id },
          { $set: toSet },
          { upsert: true }
        );
      }
      console.log(`📁 Upserted ${categories.length} categories.`);

      // Verify STANDIE in database
      const standies = await Product.find({ subCategory: "STANDIE" }).toArray();
      console.log(`\nVerified STANDIE products in ${target.name}:`);
      standies.forEach((s) => {
        console.log(`  - [${s.id}] ${s.name} (Base Price: ₹${s.basePrice})`);
      });

      const totalCount = await Product.countDocuments();
      console.log(`Total products in collection: ${totalCount}`);

      await conn.close();
      console.log(`✅ ${target.name} update completed successfully!`);
    } catch (err) {
      console.warn(`⚠️ Could not update ${target.name}: ${err.message}`);
    }
  }

  console.log(`\n========================================`);
  console.log("Database update process finished.\n");
  process.exit(0);
}

updateDatabase();
