import mongoose from "mongoose";

/**
 * Quotation Schema
 * Cloud database model replacing client-only localStorage.
 * Includes complete itemized specification, customer details, and dual costing projection.
 */
const quotationSchema = new mongoose.Schema(
  {
    quoteRef: {
      type: String,
      required: true,
      unique: true,
      index: true, // e.g. "Q-A2V-2026-0001"
    },
    version: {
      type: Number,
      default: 1,
    },
    salesExecutiveId: {
      type: String,
      required: true,
      index: true,
    },
    salesExecutiveName: {
      type: String,
      required: true,
    },
    customer: {
      name: { type: String, required: true },
      companyName: { type: String, default: "" },
      phone: { type: String, required: true },
      email: { type: String, default: "" },
      gstin: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    items: [
      {
        id: { type: String, required: true },
        productId: { type: String, required: true },
        productName: { type: String, required: true },
        productCategory: { type: String, default: "Commercial Printing" },
        finishedSize: {
          name: { type: String, default: "Custom" },
          widthInch: { type: Number, required: true },
          heightInch: { type: Number, required: true },
        },
        quantity: { type: Number, required: true }, // Books or Pads
        pagesPerBook: { type: Number, required: true }, // e.g. 100
        plyCount: { type: Number, enum: [1, 2, 3], required: true },
        plyConfigurations: [
          {
            plyIndex: { type: Number, required: true }, // 1: White, 2: Yellow, 3: Pink
            colour: { type: String, required: true },
            gsm: { type: Number, required: true },
            rawSheetSize: { type: String, required: true }, // e.g. "18x22"
            printingMethod: { type: String, enum: ["mini_offset", "digital"], required: true },
            inkColoursFront: { type: [String], default: ["Black"] },
            inkColoursBack: { type: [String], default: [] },
            cuttingYield: { type: Number, default: 0 },
            sheetsRequired: { type: Number, default: 0 },
            wastageSheets: { type: Number, default: 0 },
            purchaseMode: { type: String, enum: ["loose", "ream"], default: "loose" },
          },
        ],
        bindingType: { type: String, default: "Normal Binding" },
        hasNumbering: { type: Boolean, default: false },
        numberingFormat: {
          startNumber: { type: Number, default: 1 },
          digitCount: { type: Number, default: 4 }, // 0001
        },
        hasPunching: { type: Boolean, default: false },

        // Commercials (Visible to Sales & Client)
        quotedSellingPrice: { type: Number, required: true },
        negotiatedSellingPrice: { type: Number, required: true },
        gstAmount: { type: Number, default: 0 },
        lineTotal: { type: Number, required: true },

        // Production & Vendor Cost Breakdown (Strictly Admin / Manager Only)
        internalCostSnapshot: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    financialSummary: {
      subtotal: { type: Number, required: true },
      discountAmount: { type: Number, default: 0 },
      gstRate: { type: Number, default: 18 },
      gstAmount: { type: Number, default: 0 },
      grandTotal: { type: Number, required: true },
      // Admin Only
      totalInternalCost: { type: Number, default: 0 },
      netProfit: { type: Number, default: 0 },
      profitMarginPercent: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: ["draft", "sent_to_client", "negotiating", "approved", "rejected", "job_created"],
      default: "draft",
      index: true,
    },
    validUntil: { type: Date },
    specialNotes: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

const Quotation = mongoose.models.Quotation || mongoose.model("Quotation", quotationSchema);

export default Quotation;
