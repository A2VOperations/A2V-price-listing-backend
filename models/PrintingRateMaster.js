import mongoose from "mongoose";

/**
 * Printing Rate Master Schema (Parts 7 & 8)
 * Configures:
 * 1. Mini Offset Printing: Master making (Legal default ₹30) & Machine Running (₹70/1000 impressions per run)
 * 2. Digital Printing: 12x18 & 13x19 flat rates (Front only vs Both sides)
 */
const printingRateSchema = new mongoose.Schema(
  {
    processType: {
      type: String,
      enum: ["mini_offset", "digital"],
      required: true,
      index: true,
    },
    rateKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      // Examples:
      // "OFFSET_MASTER_LEGAL"
      // "OFFSET_RUN_PER_1000"
      // "DIGITAL_12X18_FRONT"
      // "DIGITAL_12X18_BOTH"
      // "DIGITAL_13X19_FRONT"
      // "DIGITAL_13X19_BOTH"
    },
    name: {
      type: String,
      required: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      default: "per_slab", // "per_master", "per_1000_impressions", "per_sheet"
    },
    slabImpressions: {
      type: Number,
      default: 1000,
    },
    sheetSize: {
      type: String,
      default: "", // "Legal", "12x18", "13x19"
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

const PrintingRateMaster =
  mongoose.models.PrintingRateMaster ||
  mongoose.model("PrintingRateMaster", printingRateSchema);

export default PrintingRateMaster;
