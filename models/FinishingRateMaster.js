import mongoose from "mongoose";

/**
 * Finishing Rate Master Schema (Part 10)
 * Serial Numbering (default ₹2/book, continuous across books, synchronized across plies)
 * Punching / Perforation (default ₹2/book, in binding area)
 */
const finishingRateSchema = new mongoose.Schema(
  {
    serviceType: {
      type: String,
      required: true,
      enum: ["numbering", "punching", "other"],
    },
    serviceKey: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true, // "FINISH_NUMBERING", "FINISH_PUNCHING"
    },
    name: {
      type: String,
      required: true,
    },
    ratePerBook: {
      type: Number,
      required: true,
      default: 2,
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

const FinishingRateMaster =
  mongoose.models.FinishingRateMaster ||
  mongoose.model("FinishingRateMaster", finishingRateSchema);

export default FinishingRateMaster;
