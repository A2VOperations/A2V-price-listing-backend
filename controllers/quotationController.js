import mongoose from "mongoose";
import Quotation from "../models/Quotation.js";
import JobCard from "../models/JobCard.js";
import PaperMaster from "../models/PaperMaster.js";
import PaperRate from "../models/PaperRate.js";
import PrintingRateMaster from "../models/PrintingRateMaster.js";
import BindingRateMaster from "../models/BindingRateMaster.js";
import FinishingRateMaster from "../models/FinishingRateMaster.js";
import { calculateCommercialPrintOrder } from "../services/printingCalcEngine.js";
import { verifyToken } from "../utils/authUtils.js";

function getRequester(req) {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    return verifyToken(token) || null;
  }
  return null;
}

// POST /api/quotations/calculate
// Dynamic calculation endpoint for Commercial Printing orders
export async function calculatePrintJob(req, res) {
  try {
    const body = req.body || {};
    const requester = getRequester(req);
    const role = requester?.role || "user";

    // Fetch active paper rates for plies if rates not provided
    const plies = body.plyConfigurations || [];
    for (let ply of plies) {
      if (!ply.looseSheetRate || !ply.reamRate) {
        const paper = await PaperMaster.findOne({
          colour: new RegExp(`^${ply.colour || "White"}$`, "i"),
          gsm: Number(ply.gsm) || 64,
          rawWidthInch: Number(ply.rawWidth) || 18,
          rawHeightInch: Number(ply.rawHeight) || 22,
        }).lean();

        if (paper) {
          const rate = await PaperRate.findOne({
            paperId: paper._id,
            effectiveTill: null,
          }).lean();
          if (rate) {
            ply.looseSheetRate = rate.looseSheetRate;
            ply.reamRate = rate.reamRate;
          }
        }
      }
    }

    const calcResult = calculateCommercialPrintOrder({
      productName: body.productName || "Bill Book",
      quantity: body.quantity || 10,
      pagesPerBook: body.pagesPerBook || 100,
      finishedWidth: body.finishedWidth || 8.27,
      finishedHeight: body.finishedHeight || 11.69,
      plyCount: body.plyCount || 1,
      plyConfigurations: plies,
      bindingType: body.bindingType || "Normal Binding",
      bindingRate: body.bindingRate || 25,
      hasNumbering: Boolean(body.hasNumbering),
      numberingStart: body.numberingStart || 1,
      hasPunching: Boolean(body.hasPunching),
      negotiatedSellingPrice: body.negotiatedSellingPrice,
      targetMarginPercent: body.targetMarginPercent || 25,
      gstRate: body.gstRate || 0,
    });

    // Security Firewall: Sales Executive only receives salesExecutiveView
    if (role === "admin" || role === "manager") {
      return res.json({
        success: true,
        data: {
          salesExecutiveView: calcResult.salesExecutiveView,
          managerProductionView: calcResult.managerProductionView,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        salesExecutiveView: calcResult.salesExecutiveView,
      },
    });
  } catch (error) {
    console.error("Calculate Print Job error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/quotations
export async function createQuotation(req, res) {
  try {
    const requester = getRequester(req);
    if (!requester) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const body = req.body || {};
    const quoteCount = await Quotation.countDocuments();
    const currentYear = new Date().getFullYear();
    const quoteRef = `Q-A2V-${currentYear}-${String(quoteCount + 1).padStart(4, "0")}`;

    const quoteData = {
      quoteRef,
      version: 1,
      salesExecutiveId: requester.userId || requester.id || "unknown",
      salesExecutiveName: requester.name || requester.username || "Sales Executive",
      customer: body.customer || { name: "Walk-in Client", phone: "N/A" },
      items: body.items || [],
      financialSummary: body.financialSummary || {},
      status: "draft",
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days validity
      specialNotes: body.specialNotes || "",
    };

    const newQuote = await Quotation.create(quoteData);

    return res.status(201).json({
      success: true,
      message: `Quotation ${quoteRef} created successfully.`,
      data: newQuote,
    });
  } catch (error) {
    console.error("Create Quotation error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/quotations
export async function getQuotations(req, res) {
  try {
    const requester = getRequester(req);
    if (!requester) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const query = {};
    // Non-admin sales executives can only see their own quotations
    if (requester.role !== "admin" && requester.role !== "manager") {
      query.salesExecutiveId = requester.userId || requester.id;
    }

    const quotes = await Quotation.find(query).sort({ createdAt: -1 }).lean();

    // If not admin, strip internal cost snapshots
    const sanitized = quotes.map((q) => {
      if (requester.role === "admin" || requester.role === "manager") {
        return q;
      }
      const copy = { ...q };
      if (copy.financialSummary) {
        delete copy.financialSummary.totalInternalCost;
        delete copy.financialSummary.netProfit;
        delete copy.financialSummary.profitMarginPercent;
      }
      if (Array.isArray(copy.items)) {
        copy.items = copy.items.map((it) => {
          const itCopy = { ...it };
          delete itCopy.internalCostSnapshot;
          return itCopy;
        });
      }
      return copy;
    });

    return res.json({ success: true, count: sanitized.length, data: sanitized });
  } catch (error) {
    console.error("Get Quotations error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/quotations/:quoteRef/job-card (Admin / Manager Only)
export async function createJobCardFromQuote(req, res) {
  try {
    const requester = getRequester(req);
    if (!requester || (requester.role !== "admin" && requester.role !== "manager")) {
      return res.status(403).json({
        success: false,
        message: "Forbidden. Only Admin or Production Manager can create Job Cards.",
      });
    }

    const { quoteRef } = req.params;
    const quote = await Quotation.findOne({ quoteRef }).lean();
    if (!quote) {
      return res.status(404).json({ success: false, message: "Quotation not found." });
    }

    const jobCount = await JobCard.countDocuments();
    const currentYear = new Date().getFullYear();
    const jobId = `JOB-${currentYear}-${String(jobCount + 1).padStart(4, "0")}`;

    const firstItem = quote.items[0] || {};

    const jobCard = await JobCard.create({
      jobId,
      quoteRef: quote.quoteRef,
      salesExecutiveId: quote.salesExecutiveId,
      salesExecutiveName: quote.salesExecutiveName,
      customer: {
        name: quote.customer.name,
        phone: quote.customer.phone,
        companyName: quote.customer.companyName,
      },
      productSummary: {
        name: firstItem.productName || "Commercial Print Order",
        quantity: firstItem.quantity || 1,
        pagesPerBook: firstItem.pagesPerBook || 100,
        plyCount: firstItem.plyCount || 1,
        finishedSize: `${firstItem.finishedSize?.widthInch || 8.27}x${firstItem.finishedSize?.heightInch || 11.69}`,
        bindingType: firstItem.bindingType || "Normal Binding",
        numberingRange: firstItem.hasNumbering ? "Configured" : "None",
        hasPunching: Boolean(firstItem.hasPunching),
      },
      productionDetails: firstItem.internalCostSnapshot || firstItem,
      sellingPriceTotal: quote.financialSummary?.grandTotal || 0,
      vendorCostTotal: quote.financialSummary?.totalInternalCost || 0,
      status: "created",
    });

    // Update quotation status
    await Quotation.updateOne({ quoteRef }, { $set: { status: "job_created" } });

    return res.status(201).json({
      success: true,
      message: `Production Job Card ${jobId} created successfully.`,
      data: jobCard,
    });
  } catch (error) {
    console.error("Create Job Card error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
