import CategoryModel from "../models/CategoryModel.js";

export const getCategories = async (req, res) => {
  try {
    const categories = await CategoryModel.getAll();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    if (!req.body.name) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }
    const newCategory = await CategoryModel.create(req.body);
    res.status(201).json({ success: true, data: newCategory });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const updatedCategory = await CategoryModel.update(req.params.id, req.body);
    if (!updatedCategory) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, data: updatedCategory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const deleted = await CategoryModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
