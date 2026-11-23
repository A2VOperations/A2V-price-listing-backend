import mongoose from "mongoose";

/**
 * Binding Rate Master Schema (Part 9)
 * Supports: Normal Binding, Stapler Binding, Gumming, Glue Binding, Premium, Custom.
 * Default for A4 Bill Book: ₹25 per book (includes cover, card sheet, gatta, and finishing).
 */
const bindingRateSchema = new mongoose.Schema(
  {
    bindingType: {
      type: String,
      required: true,
      trim: true,
      // "Normal Binding", "Stapler Binding", "Gumming", "Glue Binding", "Premium Binding", "Custom Binding"
    },
    bindingCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true, // e.g. "BIND_NORMAL_A4", "BIND_NORMAL_A5"
    },
    finishedSizeCategory: {
      type: String,
      required: true,
      default: "A4", // "A4", "A5", "Legal", "Custom", "All"
    },
    ratePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
    unitType: {
      type: String,
      default: "per_book", // "per_book", "per_pad", "per_piece", "per_order"
    },
    includesCoverAndGatta: {
      type: Boolean,
      default: true, // Prevents duplicate cover charges
    },
    description: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const BindingRateMaster =
  mongoose.models.BindingRateMaster ||
  mongoose.model("BindingRateMaster", bindingRateSchema);

export default BindingRateMaster;
