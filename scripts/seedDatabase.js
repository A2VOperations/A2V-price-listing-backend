import mongoose from "mongoose";
import "dotenv/config";
import Category from "../models/Category.js";
import Product from "../models/Product.js";

async function verifyDatabase() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI || !mongoURI.includes("mongodb")) {
    console.error("❌ No valid MONGODB_URI found in environment variables.");
    process.exit(1);
  }

  console.log("=================================================");
  console.log("🔍 Checking Live MongoDB Atlas Database (A2V-Pricing)");
  console.log("=================================================");

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      dbName: "A2V-Pricing",
    });
    console.log(`✅ Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

    const catCount = await Category.countDocuments();
    const prodCount = await Product.countDocuments();

    console.log(`\n📁 Total Categories in MongoDB: ${catCount}`);
    console.log(`📦 Total Products in MongoDB:   ${prodCount}`);
    console.log("\nNote: Local static JSON files have been removed. All data and calculations are managed directly in MongoDB.");
    console.log("=================================================\n");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ Database connection error:", err.message);
    process.exit(1);
  }
}

verifyDatabase();
