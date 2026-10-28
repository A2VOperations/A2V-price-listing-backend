import mongoose from "mongoose";
import "dotenv/config";
import { fileURLToPath } from "url";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import { seedUsersToDatabase } from "./seedUsers.js";

async function verifyAndSeedDatabase() {
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
      serverSelectionTimeoutMS: 8000,
      dbName: "A2V-Pricing",
    });
    console.log(`✅ Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

    const catCount = await Category.countDocuments();
    const prodCount = await Product.countDocuments();

    console.log(`\n📁 Total Categories in MongoDB: ${catCount}`);
    console.log(`📦 Total Products in MongoDB:   ${prodCount}`);

    // Inject seed users into database
    await seedUsersToDatabase();

    const userCount = await User.countDocuments();
    console.log(`👥 Total Users in MongoDB:      ${userCount}`);
    console.log("=================================================\n");

    await mongoose.disconnect();
    console.log("✅ Database verification and user seeding completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Database seeding error:", err.message);
    process.exit(1);
  }
}

const isDirectRun = Boolean(
  process.argv[1] &&
    (fileURLToPath(import.meta.url) === process.argv[1] ||
      process.argv[1].endsWith("seedDatabase.js"))
);
if (isDirectRun) {
  verifyAndSeedDatabase();
}
