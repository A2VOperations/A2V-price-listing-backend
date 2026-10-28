import User from "../models/User.js";
import { hashPassword } from "../utils/authUtils.js";

const DEFAULT_ADMIN_USERNAME = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "operationa2vgroups@gmail.com").trim().toLowerCase();
const DEFAULT_ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "admin@a2v").trim();
const DEFAULT_ADMIN_NAME = "System Administrator";

/**
 * Seed initial root admin account into MongoDB database if none exists
 */
export async function seedAdminUsers() {
  try {
    let admin = await User.findOne({ username: DEFAULT_ADMIN_USERNAME });

    if (!admin) {
      console.log(`⚡ Seeding root Admin account (${DEFAULT_ADMIN_USERNAME}) to MongoDB database...`);
      const { hash, salt } = hashPassword(DEFAULT_ADMIN_PASSWORD);

      admin = new User({
        username: DEFAULT_ADMIN_USERNAME,
        email: DEFAULT_ADMIN_EMAIL,
        name: DEFAULT_ADMIN_NAME,
        passwordHash: hash,
        passwordSalt: salt,
        role: "admin",
        createdBy: "system-seed",
      });

      await admin.save();
      console.log(`✅ Default admin stored in MongoDB database: ID="${DEFAULT_ADMIN_USERNAME}", Email="${DEFAULT_ADMIN_EMAIL}"`);
    } else {
      if (!admin.email) {
        admin.email = DEFAULT_ADMIN_EMAIL;
        await admin.save();
      }
      console.log(`👤 Admin account (${DEFAULT_ADMIN_USERNAME} / ${admin.email}) verified in MongoDB database.`);
    }
  } catch (error) {
    console.error(`❌ Failed to seed admin in MongoDB: ${error.message}`);
  }
}
