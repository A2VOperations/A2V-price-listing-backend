import mongoose from "mongoose";
import Product from "../models/Product.js";

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

// GET /api/products
export async function getProducts(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { categoryId, subCategory, search } = req.query;
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
    return res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    console.error("MongoDB Get products error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch products from MongoDB.",
    });
  }
}

// GET /api/products/:slugOrId
export async function getProductBySlug(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { slugOrId } = req.params;
    const escaped = slugOrId.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const regex = new RegExp(`^${escaped}$`, "i");

    const alternateSlug = slugOrId.includes("standee")
      ? slugOrId.replace(/standee/g, "standie")
      : slugOrId.includes("standie")
        ? slugOrId.replace(/standie/g, "standee")
        : null;

    const queryOr = [{ slug: regex }, { id: regex }, { code: regex }];
    if (alternateSlug) {
      const altEscaped = alternateSlug.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      queryOr.push({ slug: new RegExp(`^${altEscaped}$`, "i") });
    }

    const product = await Product.findOne({ $or: queryOr }).lean();

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found in MongoDB." });
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    console.error("MongoDB Get product error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch product from MongoDB.",
    });
  }
}

// POST /api/products
export async function createProduct(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

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
      quantityType: body.quantityType || "incremental",
      fixedQuantities: Array.isArray(body.fixedQuantities) ? body.fixedQuantities : [],
      minQuantity: Number(body.minQuantity) || 1000,
      quantityStep: Number(body.quantityStep) || 1000,
      basePrice: Number(body.basePrice) || 0,
    };

    const created = await Product.create(newProductData);
    console.log(`✅ [MongoDB] Product created: ${created.id} (${created.name})`);
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error("MongoDB Create product error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create product in MongoDB.",
    });
  }
}

// PUT /api/products/:id
export async function updateProduct(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { id } = req.params;

    const updated = await Product.findOneAndUpdate(
      { $or: [{ id }, { slug: id }] },
      { $set: req.body },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Product not found in MongoDB." });
    }

    console.log(`✅ [MongoDB] Product updated: ${updated.id} (${updated.name})`);
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("MongoDB Update product error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update product in MongoDB.",
    });
  }
}

// DELETE /api/products/:id
export async function deleteProduct(req, res) {
  try {
    if (!ensureDbConnected(res)) return;

    const { id } = req.params;

    const deleted = await Product.findOneAndDelete({ $or: [{ id }, { slug: id }] });
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Product not found in MongoDB." });
    }

    console.log(`🗑️ [MongoDB] Product deleted: ${deleted.id}`);
    return res.json({ success: true, message: "Product deleted successfully from MongoDB." });
  } catch (error) {
    console.error("MongoDB Delete product error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete product from MongoDB.",
    });
  }
}
