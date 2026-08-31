import ProductModel from "../models/ProductModel.js";

export const getProducts = async (req, res) => {
  try {
    const filters = {
      categoryId: req.query.categoryId,
      subCategory: req.query.subCategory,
      search: req.query.search,
    };
    const products = await ProductModel.getAll(filters);
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getProductBySlug = async (req, res) => {
  try {
    const product = await ProductModel.getBySlugOrId(req.params.slugOrId);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ success: false, message: "Product name is required" });
    }
    const newProduct = await ProductModel.create(req.body);
    res.status(201).json({ success: true, data: newProduct });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await ProductModel.update(req.params.id, req.body);
    if (!updatedProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, data: updatedProduct });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const deleted = await ProductModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
