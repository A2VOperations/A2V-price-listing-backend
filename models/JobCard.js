import mongoose from "mongoose";

/**
 * Job Card Schema (Part 15)
 * Unique Job ID for production, sales tracking, vendor work instruction, and dispatch.
 */
const jobCardSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      index: true, // e.g. "JOB-2026-0001"
    },
    quoteRef: {
      type: String,
      required: true,
      index: true,
    },
    salesExecutiveId: {
      type: String,
      required: true,
    },
    salesExecutiveName: {
      type: String,
      required: true,
    },
    customer: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      companyName: { type: String, default: "" },
    },
    productSummary: {
      name: { type: String, required: true },
      quantity: { type: Number, required: true }, // Books / Units
      pagesPerBook: { type: Number, required: true },
      plyCount: { type: Number, required: true },
      finishedSize: { type: String, required: true },
      bindingType: { type: String, required: true },
      numberingRange: { type: String, default: "None" },
      hasPunching: { type: Boolean, default: false },
    },
    // Technical instructions for Workshop / Outsourced Vendor
    productionDetails: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    vendorCostTotal: {
      type: Number,
      default: 0,
    },
    sellingPriceTotal: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "created",
        "paper_requisition",
        "in_printing",
        "in_binding_numbering",
        "ready_for_dispatch",
        "dispatched",
        "cancelled",
      ],
      default: "created",
      index: true,
    },
    vendorRemarks: {
      type: String,
      default: "",
    },
    targetDeliveryDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const JobCard = mongoose.models.JobCard || mongoose.model("JobCard", jobCardSchema);

export default JobCard;
