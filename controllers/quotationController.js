import mongoose from "mongoose";
import Quotation from "../models/Quotation.js";
import JobCard from "../models/JobCard.js";
import PaperMaster from "../models/PaperMaster.js";
import PaperRate from "../models/PaperRate.js";
import PrintingRateMaster from "../models/PrintingRateMaster.js";
import BindingRateMaster from "../models/BindingRateMaster.js";
import FinishingRateMaster from "../models/FinishingRateMaster.js";
import {
  calculateCommercialPrintOrder,
  selectLeastWastageRawSheet,
} from "../services/printingCalcEngine.js";
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

    // Fetch live Printing, Binding & Finishing Master rates from MongoDB
    const [printingDocs, bindingDocs, finishingDocs] = await Promise.all([
      PrintingRateMaster.find({ isActive: true }).lean(),
      BindingRateMaster.find({ isActive: true }).lean(),
      FinishingRateMaster.find({ isActive: true }).lean(),
    ]);

    const printRateMap = Object.fromEntries(printingDocs.map((r) => [r.rateKey, Number(r.rate)]));
    const finishRateMap = Object.fromEntries(finishingDocs.map((r) => [r.serviceKey, Number(r.ratePerBook)]));

    const bindingMatch = bindingDocs.find(
      (b) =>
        b.bindingCode === String(body.bindingType || "").toUpperCase() ||
        b.bindingType.toLowerCase() === String(body.bindingType || "Normal Binding").toLowerCase()
    );
    const resolvedBindingRate = body.bindingRate ?? bindingMatch?.ratePerUnit ?? 25;

    const masterRates = {
      masterRate: printRateMap.OFFSET_MASTER_LEGAL ?? 30,
      runRate: printRateMap.OFFSET_RUN_PER_1000 ?? 70,
      numberingRatePerBook: finishRateMap.FINISH_NUMBERING ?? 2,
      punchingRatePerBook: finishRateMap.FINISH_PUNCHING ?? 2,
      digitalRates: {
        "12x18": {
          front: printRateMap.DIGITAL_12X18_FRONT ?? 6,
          both: printRateMap.DIGITAL_12X18_BOTH ?? 7,
        },
        "13x19": {
          front: printRateMap.DIGITAL_13X19_FRONT ?? 7,
          both: printRateMap.DIGITAL_13X19_BOTH ?? 9,
        },
      },
    };

    const calcResult = calculateCommercialPrintOrder({
      productName: body.productName || "Bill Book",
      quantity: body.quantity || 10,
      pagesPerBook: body.pagesPerBook || 100,
      finishedWidth: body.finishedWidth || 8.27,
      finishedHeight: body.finishedHeight || 11.69,
      plyCount: body.plyCount || 1,
      plyConfigurations: plies,
      bindingType: body.bindingType || "Normal Binding",
      bindingRate: resolvedBindingRate,
      hasNumbering: Boolean(body.hasNumbering),
      numberingStart: body.numberingStart || 1,
      hasPunching: Boolean(body.hasPunching),
      negotiatedSellingPrice: body.negotiatedSellingPrice,
      targetMarginPercent: body.targetMarginPercent ?? 25,
      gstRate: body.gstRate ?? 0,
      masterRates,
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

// POST /api/quotations/optimal-sheet
// Picks the least-wastage raw sheet from active PaperMaster records in MongoDB
export async function getOptimalRawSheetFromDb(req, res) {
  try {
    const { finishedWidth, finishedHeight, totalPages = 1000 } = req.body || {};
    const fW = Number(finishedWidth);
    const fH = Number(finishedHeight);
    if (!Number.isFinite(fW) || !Number.isFinite(fH) || fW <= 0 || fH <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid finishedWidth and finishedHeight are required.",
      });
    }

    const papers = await PaperMaster.find({ isActive: true }).lean();
    const paperIds = papers.map((p) => p._id);
    const rates = await PaperRate.find({
      paperId: { $in: paperIds },
      effectiveTill: null,
    }).lean();
    const rateMap = new Map(rates.map((r) => [r.paperId.toString(), r]));

    const candidateSheets = papers.map((p) => {
      const r = rateMap.get(p._id.toString());
      return {
        rawWidthInch: p.rawWidthInch,
        rawHeightInch: p.rawHeightInch,
        looseSheetRate: p.looseSheetRate > 0 ? p.looseSheetRate : (r?.looseSheetRate ?? 1.5),
        reamRate: p.reamRate > 0 ? p.reamRate : (r?.reamRate ?? 700),
      };
    });

    const optimal = selectLeastWastageRawSheet({
      finishedWidth: fW,
      finishedHeight: fH,
      totalPages: Number(totalPages) || 1000,
      candidateSheets,
    });

    return res.json({ success: true, data: optimal });
  } catch (error) {
    console.error("Get Optimal Raw Sheet error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
