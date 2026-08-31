import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Category from "../models/Category.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const categoriesFilePath = path.join(__dirname, "..", "data", "categories.json");
const frontendCategoriesPath = path.join(__dirname, "..", "..", "frontend", "public", "data", "categories.json");

// Helper for fallback JSON storage
function readCategoriesFromFile() {
  try {
    if (fs.existsSync(categoriesFilePath)) {
      return JSON.parse(fs.readFileSync(categoriesFilePath, "utf8"));
    }
    if (fs.existsSync(frontendCategoriesPath)) {
      return JSON.parse(fs.readFileSync(frontendCategoriesPath, "utf8"));
    }
  } catch (err) {
    console.error("Error reading categories JSON:", err);
  }
  return [];
}

function syncCategoriesToFile(categories) {
  try {
    const json = JSON.stringify(categories, null, 2);
    fs.writeFileSync(categoriesFilePath, json, "utf8");
    if (fs.existsSync(path.dirname(frontendCategoriesPath))) {
      fs.writeFileSync(frontendCategoriesPath, json, "utf8");
    }
  } catch (err) {
    console.warn("Could not sync categories to file:", err.message);
  }
}

// GET /api/categories
export async function getCategories(req, res) {
  try {
    if (mongoose.connection.readyState === 1) {
      const categories = await Category.find().sort({ createdAt: 1 }).lean();
      return res.json({ success: true, data: categories });
    }
    // Fallback if DB not connected
    const categories = readCategoriesFromFile();
    return res.json({ success: true, data: categories });
  } catch (error) {
    console.error("Get categories error:", error);
    const categories = readCategoriesFromFile();
    return res.json({ success: true, data: categories });
  }
}

// POST /api/categories
export async function createCategory(req, res) {
  try {
    const { name, image, description } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required." });
    }

    const id = req.body.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const slug = req.body.slug || id;

    const categoryData = {
      id,
      slug,
      name,
      image: image || "/assets/images/categories (1).webp",
      description: description || "",
    };

    if (mongoose.connection.readyState === 1) {
      const existing = await Category.findOne({ $or: [{ id }, { slug }] });
      if (existing) {
        return res.status(400).json({ success: false, message: "Category ID or Slug already exists." });
      }
      const newCategory = await Category.create(categoryData);
      
      // Sync file in background
      Category.find().lean().then(syncCategoriesToFile).catch(() => {});

      return res.status(201).json({ success: true, data: newCategory });
    }

    // Fallback
    const categories = readCategoriesFromFile();
    if (categories.some((c) => c.id === id || c.slug === slug)) {
      return res.status(400).json({ success: false, message: "Category ID or Slug already exists." });
    }
    categories.push(categoryData);
    syncCategoriesToFile(categories);
    return res.status(201).json({ success: true, data: categoryData });
  } catch (error) {
    console.error("Create category error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create category." });
  }
}

// PUT /api/categories/:id
export async function updateCategory(req, res) {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      const updated = await Category.findOneAndUpdate(
        { $or: [{ id }, { slug: id }] },
        { $set: req.body },
        { new: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ success: false, message: "Category not found." });
      }

      Category.find().lean().then(syncCategoriesToFile).catch(() => {});
      return res.json({ success: true, data: updated });
    }

    // Fallback
    const categories = readCategoriesFromFile();
    const index = categories.findIndex((c) => c.id === id || c.slug === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }
    categories[index] = { ...categories[index], ...req.body };
    syncCategoriesToFile(categories);
    return res.json({ success: true, data: categories[index] });
  } catch (error) {
    console.error("Update category error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update category." });
  }
}

// DELETE /api/categories/:id
export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      const deleted = await Category.findOneAndDelete({ $or: [{ id }, { slug: id }] });
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Category not found." });
      }

      Category.find().lean().then(syncCategoriesToFile).catch(() => {});
      return res.json({ success: true, message: "Category deleted successfully." });
    }

    // Fallback
    let categories = readCategoriesFromFile();
    const initialLen = categories.length;
    categories = categories.filter((c) => c.id !== id && c.slug !== id);
    if (categories.length === initialLen) {
      return res.status(404).json({ success: false, message: "Category not found." });
    }
    syncCategoriesToFile(categories);
    return res.json({ success: true, message: "Category deleted successfully." });
  } catch (error) {
    console.error("Delete category error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to delete category." });
  }
}
