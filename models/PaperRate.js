import mongoose from "mongoose";

/**
 * Paper Rate Schema with Versioning (Part 4.4 & 4.5)
 * Maintains Loose Sheet Rate & Ream Rate (500 sheets/ream) with historical snapshot tracking.
 */
const paperRateSchema = new mongoose.Schema(
  {
    paperId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PaperMaster",
      required: true,
      index: true,
    },
    paperCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    looseSheetRate: {
      type: Number,
      required: true,
      min: 0, // Cost per individual raw sheet
    },
    reamRate: {
      type: Number,
      required: true,
      min: 0, // Cost per 500 sheets ream
    },
    isProvisional: {
      type: Boolean,
      default: false, // Flag if the rate is provisional pending market confirmation
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
      index: true,
    },
    effectiveTill: {
      type: Date,
      default: null, // Null means currently active version
    },
    updatedBy: {
      type: String,
      default: "admin",
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

paperRateSchema.index({ paperId: 1, effectiveTill: 1 });

const PaperRate = mongoose.models.PaperRate || mongoose.model("PaperRate", paperRateSchema);

export default PaperRate;
