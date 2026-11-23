import mongoose from "mongoose";

/**
 * Paper Master Schema
 * Represents raw sheet sizes, GSM grades, and available paper colours.
 */
const paperMasterSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true, // e.g. "PAP-1822-70-WHT"
    },
    rawWidthInch: {
      type: Number,
      required: true, // e.g. 18, 23, 25
    },
    rawHeightInch: {
      type: Number,
      required: true, // e.g. 22, 36
    },
    gsm: {
      type: Number,
      required: true, // e.g. 58, 64, 70, 80, 90, 100, 115
    },
    gsmLabel: {
      type: String,
      default: function () {
        return `${this.gsm} GSM`;
      },
    },
    colour: {
      type: String,
      required: true,
      trim: true,
      default: "White",
    },
    paperType: {
      type: String,
      trim: true,
      default: "Maplitho", // e.g. "Newspaper", "Maplitho", "Bond", "Sunshine", "Art Paper"
    },
    looseSheetRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    reamRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    isDigitalCompatible: {
      type: Boolean,
      default: function () {
        // As per business rule: Digital printing is strictly restricted to White paper only
        return this.colour === "White";
      },
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

paperMasterSchema.index({ rawWidthInch: 1, rawHeightInch: 1, gsm: 1, colour: 1 });

const PaperMaster = mongoose.models.PaperMaster || mongoose.model("PaperMaster", paperMasterSchema);

export default PaperMaster;
