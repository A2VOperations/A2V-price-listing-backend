import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Category from "./Category.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const categoriesFilePath = path.join(__dirname, "..", "data", "categories.json");

class CategoryModel {
  static isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Fetch all categories directly from MongoDB
  static async getAll() {
    if (this.isDbConnected()) {
      try {
        const categories = await Category.find().lean();
        return categories;
      } catch (err) {
        console.warn("MongoDB Category.find error:", err.message);
      }
    }
    return this._readFromFile();
  }

  // Fetch single category by ID or slug directly from MongoDB
  static async getByIdOrSlug(idOrSlug) {
    if (this.isDbConnected()) {
      try {
        const cat = await Category.findOne({
          $or: [{ id: idOrSlug }, { slug: idOrSlug }],
        }).lean();
        if (cat) return cat;
      } catch (err) {
        console.warn("MongoDB Category.findOne error:", err.message);
      }
    }
    const categories = this._readFromFile();
    return categories.find((c) => c.id === idOrSlug || c.slug === idOrSlug) || null;
  }

  // Create new category in MongoDB
  static async create(categoryData) {
    const id = categoryData.id || categoryData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const slug = categoryData.slug || categoryData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    const payload = {
      id,
      slug,
      name: categoryData.name,
      image: categoryData.image || "/src/assets/images/categories (1).webp",
      description: categoryData.description || "",
    };

    if (this.isDbConnected()) {
      try {
        const newCat = await Category.create(payload);
        this._syncToFile(payload, "add");
        return newCat.toObject();
      } catch (err) {
        console.warn("MongoDB Category.create error:", err.message);
      }
    }

    const categories = this._readFromFile();
    categories.push(payload);
    this._saveToFile(categories);
    return payload;
  }

  // Update category in MongoDB
  static async update(id, categoryData) {
    if (this.isDbConnected()) {
      try {
        const updated = await Category.findOneAndUpdate(
          { $or: [{ id }, { slug: id }] },
          { $set: categoryData },
          { new: true }
        ).lean();
        if (updated) {
          this._syncToFile(updated, "update");
          return updated;
        }
      } catch (err) {
        console.warn("MongoDB Category.findOneAndUpdate error:", err.message);
      }
    }

    const categories = this._readFromFile();
    const index = categories.findIndex((c) => c.id === id || c.slug === id);
    if (index === -1) return null;

    categories[index] = { ...categories[index], ...categoryData };
    this._saveToFile(categories);
    return categories[index];
  }

  // Delete category in MongoDB
  static async delete(id) {
    let dbDeleted = false;
    if (this.isDbConnected()) {
      try {
        const res = await Category.findOneAndDelete({
          $or: [{ id }, { slug: id }],
        });
        if (res) dbDeleted = true;
      } catch (err) {
        console.warn("MongoDB Category.findOneAndDelete error:", err.message);
      }
    }

    let categories = this._readFromFile();
    const initialLength = categories.length;
    categories = categories.filter((c) => c.id !== id && c.slug !== id);
    const fileDeleted = categories.length < initialLength;
    this._saveToFile(categories);

    return dbDeleted || fileDeleted;
  }

  // Fallback file helpers
  static _readFromFile() {
    try {
      if (!fs.existsSync(categoriesFilePath)) return [];
      const data = fs.readFileSync(categoriesFilePath, "utf8");
      return JSON.parse(data);
    } catch (err) {
      return [];
    }
  }

  static _saveToFile(categories) {
    try {
      fs.writeFileSync(categoriesFilePath, JSON.stringify(categories, null, 2), "utf8");
    } catch (err) {
      console.error("Error saving categories to file:", err);
    }
  }

  static _syncToFile(item, action) {
    const categories = this._readFromFile();
    if (action === "add") {
      categories.push(item);
    } else if (action === "update") {
      const idx = categories.findIndex((c) => c.id === item.id || c.slug === item.slug);
      if (idx !== -1) categories[idx] = { ...categories[idx], ...item };
      else categories.push(item);
    }
    this._saveToFile(categories);
  }
}

export default CategoryModel;
