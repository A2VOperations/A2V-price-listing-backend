import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Product from "../models/Product.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const productsFilePath = path.join(__dirname, "..", "data", "products.json");
const frontendProductsPath = path.join(__dirname, "..", "..", "frontend", "public", "data", "products.json");
const frontendSrcProductsPath = path.join(__dirname, "..", "..", "frontend", "src", "data", "products.json");

// Helper for fallback JSON storage
function readProductsFromFile() {
  try {
    if (fs.existsSync(productsFilePath)) {
      return JSON.parse(fs.readFileSync(productsFilePath, "utf8"));
    }
    if (fs.existsSync(frontendProductsPath)) {
      return JSON.parse(fs.readFileSync(frontendProductsPath, "utf8"));
    }
  } catch (err) {
    console.error("Error reading products JSON:", err);
  }
  return [];
}

function syncProductsToFile(products) {
  try {
    const json = JSON.stringify(products, null, 2);
    fs.writeFileSync(productsFilePath, json, "utf8");
    if (fs.existsSync(path.dirname(frontendProductsPath))) {
      fs.writeFileSync(frontendProductsPath, json, "utf8");
    }
    if (fs.existsSync(path.dirname(frontendSrcProductsPath))) {
      fs.writeFileSync(frontendSrcProductsPath, json, "utf8");
    }
  } catch (err) {
    console.warn("Could not sync products to file:", err.message);
  }
}

// GET /api/products
export async function getProducts(req, res) {
  try {
    const { categoryId, subCategory, search } = req.query;

    if (mongoose.connection.readyState === 1) {
      const query = {};
      if (categoryId) query.categoryId = categoryId;
      if (subCategory) query.subCategory = subCategory;

      if (search) {
        const regex = new RegExp(search.trim(), "i");
        query.$or = [
          { name: regex },
          { code: regex },
          { categoryId: regex },
          { subCategory: regex },
          { description: regex },
        ];
      }

      const products = await Product.find(query).sort({ createdAt: -1 }).lean();
      return res.json({ success: true, data: products });
    }

    // Fallback if DB not ready
    let products = readProductsFromFile();
    if (categoryId) {
      products = products.filter((p) => p.categoryId === categoryId);
    }
    if (subCategory) {
      products = products.filter((p) => p.subCategory === subCategory);
    }
    if (search) {
      const q = search.toLowerCase().trim();
      products = products.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.code && p.code.toLowerCase().includes(q)) ||
          (p.categoryId && p.categoryId.toLowerCase().includes(q)) ||
          (p.subCategory && p.subCategory.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return res.json({ success: true, data: products });
  } catch (error) {
    console.error("Get products error:", error);
    const products = readProductsFromFile();
    return res.json({ success: true, data: products });
  }
}

// GET /api/products/:slugOrId
export async function getProductBySlug(req, res) {
  try {
    const { slugOrId } = req.params;

    if (mongoose.connection.readyState === 1) {
      const product = await Product.findOne({
        $or: [{ slug: slugOrId }, { id: slugOrId }, { code: slugOrId }],
      }).lean();

      if (!product) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }
      return res.json({ success: true, data: product });
    }

    // Fallback
    const products = readProductsFromFile();
    const product = products.find(
      (p) => p.slug === slugOrId || p.id === slugOrId || p.code === slugOrId
    );

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    return res.json({ success: true, data: product });
  } catch (error) {
    console.error("Get product error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch product." });
  }
}

// POST /api/products
export async function createProduct(req, res) {
  try {
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ success: false, message: "Product name is required." });
    }

    const id = body.id || `AP-${Date.now().toString().slice(-6)}`;
    const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

    const newProductData = {
      ...body,
      id,
      slug,
      minQuantity: Number(body.minQuantity) || 1000,
      quantityStep: Number(body.quantityStep) || 1000,
      basePrice: Number(body.basePrice) || 0,
    };

    if (mongoose.connection.readyState === 1) {
      const created = await Product.create(newProductData);
      Product.find().lean().then(syncProductsToFile).catch(() => {});
      return res.status(201).json({ success: true, data: created });
    }

    // Fallback
    const products = readProductsFromFile();
    products.push(newProductData);
    syncProductsToFile(products);
    return res.status(201).json({ success: true, data: newProductData });
  } catch (error) {
    console.error("Create product error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to create product." });
  }
}

// PUT /api/products/:id
export async function updateProduct(req, res) {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      const updated = await Product.findOneAndUpdate(
        { $or: [{ id }, { slug: id }] },
        { $set: req.body },
        { new: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }

      Product.find().lean().then(syncProductsToFile).catch(() => {});
      return res.json({ success: true, data: updated });
    }

    // Fallback
    const products = readProductsFromFile();
    const index = products.findIndex((p) => p.id === id || p.slug === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    products[index] = { ...products[index], ...req.body };
    syncProductsToFile(products);
    return res.json({ success: true, data: products[index] });
  } catch (error) {
    console.error("Update product error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to update product." });
  }
}

// DELETE /api/products/:id
export async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    if (mongoose.connection.readyState === 1) {
      const deleted = await Product.findOneAndDelete({ $or: [{ id }, { slug: id }] });
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Product not found." });
      }

      Product.find().lean().then(syncProductsToFile).catch(() => {});
      return res.json({ success: true, message: "Product deleted successfully." });
    }

    // Fallback
    let products = readProductsFromFile();
    const initialLen = products.length;
    products = products.filter((p) => p.id !== id && p.slug !== id);
    if (products.length === initialLen) {
      return res.status(404).json({ success: false, message: "Product not found." });
    }
    syncProductsToFile(products);
    return res.json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    console.error("Delete product error:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to delete product." });
  }
}
