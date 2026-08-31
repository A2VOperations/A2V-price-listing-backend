import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Product from "./Product.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productsFilePath = path.join(__dirname, "..", "data", "products.json");
const srcProductsFilePath = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "data",
  "products.json",
);

class ProductModel {
  static isDbConnected() {
    return mongoose.connection.readyState === 1;
  }

  // Fetch all products directly from MongoDB
  static async getAll(filters = {}) {
    if (this.isDbConnected()) {
      try {
        const query = {};
        if (filters.categoryId) query.categoryId = filters.categoryId;
        if (filters.subCategory) query.subCategory = filters.subCategory;
        if (filters.search) {
          const q = filters.search.toLowerCase().trim();
          query.$or = [
            { name: { $regex: q, $options: "i" } },
            { code: { $regex: q, $options: "i" } },
            { categoryId: { $regex: q, $options: "i" } },
            { subCategory: { $regex: q, $options: "i" } },
            { description: { $regex: q, $options: "i" } },
          ];
        }
        const products = await Product.find(query).lean();
        return products;
      } catch (err) {
        console.warn("MongoDB Product.find error:", err.message);
      }
    }
    return this._readFromFile(filters);
  }

  // Fetch single product by ID or slug directly from MongoDB
  static async getBySlugOrId(slugOrId) {
    if (this.isDbConnected()) {
      try {
        const p = await Product.findOne({
          $or: [{ id: slugOrId }, { slug: slugOrId }, { code: slugOrId }],
        }).lean();
        if (p) return p;
      } catch (err) {
        console.warn("MongoDB Product.findOne error:", err.message);
      }
    }
    const products = this._readFromFile();
    return (
      products.find(
        (p) => p.slug === slugOrId || p.id === slugOrId || p.code === slugOrId,
      ) || null
    );
  }

  // Create product directly in MongoDB
  static async create(productData) {
    const payload = {
      id: productData.id || `AP-${Date.now().toString().slice(-5)}`,
      code: productData.code || `CODE-${Math.floor(Math.random() * 1000)}`,
      categoryId: productData.categoryId || "visiting-cards",
      subCategory: productData.subCategory || "General Products",
      name: productData.name,
      slug:
        productData.slug ||
        productData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      image: productData.image || "/src/assets/images/categories (1).webp",
      description: productData.description || "",
      minQuantity: Number(productData.minQuantity) || 1000,
      quantityStep: Number(productData.quantityStep) || 1000,
      productionTime: productData.productionTime || "3-7 Days",
      basePrice: Number(productData.basePrice) || 0,
      unitName: productData.unitName || "Cards",
      pricingModel: productData.pricingModel || "quantity_tiered",
      variantCombinations: productData.variantCombinations || [],
      variantDetails: productData.variantDetails || {},
      quantityPricingTiers: productData.quantityPricingTiers || [],
      specifications: productData.specifications || {},
      ourSpecialization: productData.ourSpecialization || [],
      productSpecialization: productData.productSpecialization || [],
      importantNotes: productData.importantNotes || [],
      fileRequirements: productData.fileRequirements || {},
      options: productData.options || [],
    };

    if (this.isDbConnected()) {
      try {
        const newDoc = await Product.create(payload);
        this._syncToFile(payload, "add");
        return newDoc.toObject();
      } catch (err) {
        console.warn("MongoDB Product.create error:", err.message);
      }
    }

    const products = this._readFromFile();
    products.push(payload);
    this._saveToFile(products);
    return payload;
  }

  // Update product directly in MongoDB
  static async update(id, productData) {
    if (this.isDbConnected()) {
      try {
        const updated = await Product.findOneAndUpdate(
          { $or: [{ id }, { slug: id }] },
          { $set: productData },
          { new: true },
        ).lean();
        if (updated) {
          this._syncToFile(updated, "update");
          return updated;
        }
      } catch (err) {
        console.warn("MongoDB Product.findOneAndUpdate error:", err.message);
      }
    }

    const products = this._readFromFile();
    const index = products.findIndex((p) => p.id === id || p.slug === id);
    if (index === -1) return null;

    products[index] = { ...products[index], ...productData };
    this._saveToFile(products);
    return products[index];
  }

  // Delete product directly in MongoDB
  static async delete(id) {
    let dbDeleted = false;
    if (this.isDbConnected()) {
      try {
        const res = await Product.findOneAndDelete({
          $or: [{ id }, { slug: id }],
        });
        if (res) dbDeleted = true;
      } catch (err) {
        console.warn("MongoDB Product.findOneAndDelete error:", err.message);
      }
    }

    let products = this._readFromFile();
    const initialLength = products.length;
    products = products.filter((p) => p.id !== id && p.slug !== id);
    const fileDeleted = products.length < initialLength;
    this._saveToFile(products);

    return dbDeleted || fileDeleted;
  }

  // Fallback file helpers
  static _readFromFile(filters = {}) {
    try {
      if (!fs.existsSync(productsFilePath)) return [];
      const data = fs.readFileSync(productsFilePath, "utf8");
      let products = JSON.parse(data);

      const { categoryId, subCategory, search } = filters;
      if (categoryId)
        products = products.filter((p) => p.categoryId === categoryId);
      if (subCategory)
        products = products.filter((p) => p.subCategory === subCategory);
      if (search) {
        const q = search.toLowerCase().trim();
        products = products.filter(
          (p) =>
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.code && p.code.toLowerCase().includes(q)) ||
            (p.categoryId && p.categoryId.toLowerCase().includes(q)) ||
            (p.subCategory && p.subCategory.toLowerCase().includes(q)) ||
            (p.description && p.description.toLowerCase().includes(q)),
        );
      }

      return products;
    } catch (err) {
      return [];
    }
  }

  static _saveToFile(products) {
    try {
      fs.writeFileSync(
        productsFilePath,
        JSON.stringify(products, null, 2),
        "utf8",
      );
      try {
        fs.writeFileSync(
          srcProductsFilePath,
          JSON.stringify(products, null, 2),
          "utf8",
        );
      } catch (e) {}
    } catch (err) {
      console.error("Error saving products to file:", err);
    }
  }

  static _syncToFile(item, action) {
    const products = this._readFromFile();
    if (action === "add") {
      products.push(item);
    } else if (action === "update") {
      const idx = products.findIndex(
        (p) => p.id === item.id || p.slug === item.slug,
      );
      if (idx !== -1) products[idx] = { ...products[idx], ...item };
      else products.push(item);
    }
    this._saveToFile(products);
  }
}

export default ProductModel;
