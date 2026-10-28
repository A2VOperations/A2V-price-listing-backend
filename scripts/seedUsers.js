import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config();

import User from "../models/User.js";
import { hashPassword } from "../utils/authUtils.js";

const DEFAULT_ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "operation.a2vgroups@gmail.com").trim().toLowerCase();
const DEFAULT_ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "admin@a2v").trim();
const DEFAULT_ADMIN_NAME = "System Administrator";

export async function seedUsersToDatabase() {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI || !mongoURI.includes("mongodb")) {
    throw new Error("No valid MONGODB_URI found in environment variables.");
  }

  const isAlreadyConnected = mongoose.connection.readyState === 1;

  if (!isAlreadyConnected) {
    console.log("🔌 Connecting to MongoDB Database...");
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 8000,
      dbName: "A2V-Pricing",
    });
    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
  }

  console.log("\n=======================================================");
  console.log("🌱 INJECTING SEED ADMIN INTO MONGODB DATABASE");
  console.log("=======================================================");

  const seedAccounts = [
    {
      username: DEFAULT_ADMIN_USERNAME,
      email: DEFAULT_ADMIN_EMAIL,
      name: DEFAULT_ADMIN_NAME,
      password: DEFAULT_ADMIN_PASSWORD,
      role: "admin",
      description: "Root Administrator Account",
    },
  ];

  for (const account of seedAccounts) {
    const { hash, salt } = hashPassword(account.password);

    // Look for existing user by username
    const existing = await User.findOne({ username: account.username });

    if (existing) {
      existing.email = account.email;
      existing.name = account.name;
      existing.passwordHash = hash;
      existing.passwordSalt = salt;
      existing.role = account.role;
      existing.createdBy = "seed-script";
      await existing.save();
      console.log(`🔄 Updated existing account in MongoDB: ID="${account.username}", Email="${account.email}" (Role: ${account.role})`);
    } else {
      const newUser = new User({
        username: account.username,
        email: account.email,
        name: account.name,
        passwordHash: hash,
        passwordSalt: salt,
        role: account.role,
        createdBy: "seed-script",
      });
      await newUser.save();
      console.log(`✨ Injected new account into MongoDB: ID="${account.username}", Email="${account.email}" (Role: ${account.role})`);
    }
  }

  const totalUsers = await User.countDocuments();
  console.log(`\n📊 Total Users in MongoDB Database: ${totalUsers}`);
  console.log("=======================================================\n");

  if (!isAlreadyConnected) {
    await mongoose.disconnect();
    console.log("🔌 Database disconnected cleanly.");
  }

  return true;
}

// Allow direct CLI execution: node scripts/seedUsers.js
const isDirectRun = Boolean(
  process.argv[1] &&
    (fileURLToPath(import.meta.url) === process.argv[1] ||
      process.argv[1].endsWith("seedUsers.js"))
);
if (isDirectRun) {
  seedUsersToDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed injection failed:", err.message);
      process.exit(1);
    });
}
