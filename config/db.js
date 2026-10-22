import mongoose from "mongoose";
import Category from "../models/Category.js";
import Product from "../models/Product.js";

export async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error("❌ MONGODB_URI is not defined in environment variables. MongoDB is required.");
    return;
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
      dbName: "A2V-Pricing",
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    // Quick verification log
    const catCount = await Category.countDocuments();
    const prodCount = await Product.countDocuments();
    console.log(`📊 Database Status: ${catCount} categories, ${prodCount} products loaded in MongoDB.`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
  }
}
