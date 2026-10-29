import mongoose from "mongoose";
import User from "../models/User.js";
import { hashPassword } from "../utils/authUtils.js";

function ensureDbConnected(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      message: "MongoDB connection is not active. Database is required to manage users.",
    });
    return false;
  }
  return true;
}

/**
 * GET /api/users
 * Admin only: Fetch all users stored in MongoDB database
 */
export async function getAllUsers(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const users = await User.find({})
      .select("-passwordHash -passwordSalt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: users.map((u) => ({
        id: u._id.toString(),
        _id: u._id.toString(),
        username: u.username,
        email: u.email || "",
        name: u.name,
        role: u.role,
        createdBy: u.createdBy,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      count: users.length,
    });
  } catch (error) {
    console.error("MongoDB Get Users Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to retrieve user list from database.",
    });
  }
}

/**
 * POST /api/users
 * Admin only: Create a new user record in the MongoDB database
 */
export async function createUser(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { username, name, password, role } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and Password are required.",
      });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const cleanPassword = String(password).trim();
    const cleanName = String(name || "").trim();
    const cleanRole = role === "admin" ? "admin" : "user";

    if (cleanUsername.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters long.",
      });
    }

    if (cleanPassword.length < 4) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 4 characters long.",
      });
    }

    // Check if username already exists in MongoDB
    const existingUser = await User.findOne({ username: cleanUsername });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: `Username '${cleanUsername}' already exists in database.`,
      });
    }

    // Hash the password securely
    const { hash, salt } = hashPassword(cleanPassword);
    const adminCreator = req.user?.username || "admin";

    // Save directly to MongoDB database
    const newUser = new User({
      username: cleanUsername,
      email: "",
      name: cleanName || cleanUsername,
      passwordHash: hash,
      passwordSalt: salt,
      role: cleanRole,
      createdBy: adminCreator,
    });

    const savedUser = await newUser.save();

    return res.status(201).json({
      success: true,
      message: `User '${cleanUsername}' stored successfully in database with role '${cleanRole}'.`,
      data: savedUser.toSafeObject(),
    });
  } catch (error) {
    console.error("MongoDB Create User Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save user in database.",
    });
  }
}

/**
 * PUT /api/users/:id
 * Admin only: Update user details or reset password in MongoDB database
 */
export async function updateUser(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { id } = req.params;
    const { name, email, role, password } = req.body || {};

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found in database.",
      });
    }

    if (name !== undefined) user.name = String(name).trim();
    if (email !== undefined && String(email).trim()) {
      user.email = String(email).trim().toLowerCase();
    }

    if (role !== undefined && ["admin", "user"].includes(role)) {
      user.role = role;
    }

    if (password && String(password).trim().length >= 4) {
      const { hash, salt } = hashPassword(String(password).trim());
      user.passwordHash = hash;
      user.passwordSalt = salt;
    }

    await user.save();

    return res.json({
      success: true,
      message: `User '${user.username}' updated successfully in database.`,
      data: user.toSafeObject(),
    });
  } catch (error) {
    console.error("MongoDB Update User Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update user in database.",
    });
  }
}

/**
 * DELETE /api/users/:id
 * Admin only: Delete user from MongoDB database
 */
export async function deleteUser(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { id } = req.params;

    // Disallow deleting current logged-in user
    if (req.user && req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own currently logged-in account.",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found in database.",
      });
    }

    if (user.username === "admin") {
      return res.status(400).json({
        success: false,
        message: "The root default admin account cannot be deleted.",
      });
    }

    await User.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: `User '${user.username}' removed from database.`,
    });
  } catch (error) {
    console.error("MongoDB Delete User Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete user from database.",
    });
  }
}
