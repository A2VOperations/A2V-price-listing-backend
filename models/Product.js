import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
    },
    categoryId: {
      type: String,
      required: true,
      index: true,
    },
    subCategory: {
      type: String,
      default: "General Products",
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    image: {
      type: String,
      default: "/src/assets/images/categories (1).webp",
    },
    images: [
      {
        type: String,
      },
    ],
    description: {
      type: String,
      default: "",
    },
    minQuantity: {
      type: Number,
      default: 1000,
    },
    quantityStep: {
      type: Number,
      default: 1000,
    },
    productionTime: {
      type: String,
      default: "Within 3-7 days",
    },
    basePrice: {
      type: Number,
      default: 0,
    },
    unitName: {
      type: String,
      default: "Cards",
    },
    pricingModel: {
      type: String,
      default: "quantity_tiered",
    },
    variantCombinations: [
      {
        type: String,
      },
    ],
    variantDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    quantityPricingTiers: [
      {
        minQty: { type: Number },
        pricePerUnit: { type: Number },
      },
    ],
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ourSpecialization: [{ type: String }],
    productSpecialization: [{ type: String }],
    importantNotes: [{ type: String }],
    fileRequirements: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    options: [{ type: mongoose.Schema.Types.Mixed }],
  },
  { timestamps: true }
);

const Product = mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;
