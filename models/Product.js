import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    subCategory: {
      type: String,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    image: {
      type: String,
      default: "",
    },
    images: {
      type: [String],
      default: [],
    },
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
      default: "3-7 Days",
    },
    basePrice: {
      type: Number,
      default: 0,
    },
    unitName: {
      type: String,
      default: "Pieces",
    },
    pricingModel: {
      type: String,
      default: "quantity_tiered",
    },
    variantCombinations: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    variantDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    quantityPricingTiers: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ourSpecialization: {
      type: [String],
      default: [],
    },
    productSpecialization: {
      type: [String],
      default: [],
    },
    importantNotes: {
      type: [String],
      default: [],
    },
    fileRequirements: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    options: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    additionalOptions: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    strict: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Add text indexing for search
productSchema.index({
  name: "text",
  code: "text",
  description: "text",
  subCategory: "text",
});

const Product = mongoose.model("Product", productSchema);

export default Product;
