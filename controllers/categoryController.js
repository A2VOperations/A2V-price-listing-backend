import mongoose from "mongoose";
import Category from "../models/Category.js";

function ensureDbConnected(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      message: "MongoDB connection is not active. Database is required.",
    });
    return false;
  }
  return true;
}

// GET /api/categories
export async function getCategories(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const categories = await Category.find().sort({ createdAt: 1 }).lean();
    return res.json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    console.error("MongoDB Get categories error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch categories from MongoDB.",
    });
  }
}

// GET /api/categories/:id
export async function getCategoryById(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { id } = req.params;
    const category = await Category.findOne({
      $or: [{ id }, { slug: id }],
    }).lean();

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found in MongoDB." });
    }

    return res.json({ success: true, data: category });
  } catch (error) {
    console.error("MongoDB Get category error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch category from MongoDB.",
    });
  }
}

// POST /api/categories
export async function createCategory(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { name, image, description } = req.body || {};
    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required." });
    }

    const id = req.body.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const slug = req.body.slug || id;

    const existing = await Category.findOne({ $or: [{ id }, { slug }] });
    if (existing) {
      return res.status(400).json({ success: false, message: "Category ID or Slug already exists in MongoDB." });
    }

    const categoryData = {
      id,
      slug,
      name,
      image: image || "/assets/images/categories (1).webp",
      description: description || "",
    };

    const newCategory = await Category.create(categoryData);
    console.log(`✅ [MongoDB] Category created: ${newCategory.id} (${newCategory.name})`);
    return res.status(201).json({ success: true, data: newCategory });
  } catch (error) {
    console.error("MongoDB Create category error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create category in MongoDB.",
    });
  }
}

// PUT /api/categories/:id
export async function updateCategory(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { id } = req.params;

    const updated = await Category.findOneAndUpdate(
      { $or: [{ id }, { slug: id }] },
      { $set: req.body },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Category not found in MongoDB." });
    }

    console.log(`✅ [MongoDB] Category updated: ${updated.id} (${updated.name})`);
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("MongoDB Update category error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update category in MongoDB.",
    });
  }
}

// DELETE /api/categories/:id
export async function deleteCategory(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { id } = req.params;

    const deleted = await Category.findOneAndDelete({ $or: [{ id }, { slug: id }] });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Category not found in MongoDB." });
    }

    console.log(`🗑️ [MongoDB] Category deleted: ${deleted.id}`);
    return res.json({ success: true, message: "Category deleted successfully from MongoDB." });
  } catch (error) {
    console.error("MongoDB Delete category error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete category from MongoDB.",
    });
  }
}
