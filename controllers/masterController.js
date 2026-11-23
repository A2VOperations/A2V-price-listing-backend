import mongoose from "mongoose";
import PaperMaster from "../models/PaperMaster.js";
import PaperRate from "../models/PaperRate.js";
import PrintingRateMaster from "../models/PrintingRateMaster.js";
import BindingRateMaster from "../models/BindingRateMaster.js";
import FinishingRateMaster from "../models/FinishingRateMaster.js";
import { verifyToken } from "../utils/authUtils.js";

function getRequesterRole(req) {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const payload = verifyToken(token);
    return payload?.role || "user";
  }
  return "user";
}

// ----------------- PAPER MASTER & RATES -----------------

// GET /api/masters/papers
export async function getPaperMasters(req, res) {
  try {
    const { gsm, colour, width, height } = req.query;
    const query = { isActive: true };
    if (gsm) query.gsm = Number(gsm);
    if (colour) query.colour = new RegExp(`^${colour}$`, "i");
    if (width) query.rawWidthInch = Number(width);
    if (height) query.rawHeightInch = Number(height);

    const papers = await PaperMaster.find(query).sort({ rawWidthInch: 1, gsm: 1 }).lean();
    const role = getRequesterRole(req);

    // Fetch active rates for each paper
    const paperIds = papers.map((p) => p._id);
    const rates = await PaperRate.find({
      paperId: { $in: paperIds },
      effectiveTill: null,
    }).lean();

    const rateMap = {};
    rates.forEach((r) => {
      rateMap[r.paperId.toString()] = r;
    });

    const enriched = papers.map((paper) => {
      const activeRate = rateMap[paper._id.toString()] || null;
      const looseRatePerSheet =
        paper.looseSheetRate !== undefined && paper.looseSheetRate > 0
          ? paper.looseSheetRate
          : (activeRate ? activeRate.looseSheetRate : 0);
      const reamRate =
        paper.reamRate !== undefined && paper.reamRate > 0
          ? paper.reamRate
          : (activeRate ? activeRate.reamRate : 0);

      return {
        ...paper,
        rawSheetWidth: paper.rawWidthInch,
        rawHeightInch: paper.rawHeightInch,
        looseSheetRate: looseRatePerSheet,
        reamRate: reamRate,
        activeRate: activeRate || { looseSheetRate: looseRatePerSheet, reamRate },
        currentRate: {
          looseRatePerSheet,
          reamRate,
          effectiveFrom: activeRate?.effectiveFrom || paper.updatedAt,
          updatedBy: activeRate?.updatedBy || "admin",
          remarks: activeRate?.remarks || "",
        },
      };
    });

    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    console.error("Get Paper Masters error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/masters/papers (Create a new Sheet in database)
export async function createPaperMaster(req, res) {
  try {
    const {
      rawWidthInch,
      rawHeightInch,
      paperType = "Newspaper",
      gsm,
      colour = "White",
      looseSheetRate = 0,
      reamRate = 0,
      description = "",
    } = req.body || {};

    if (!rawWidthInch || !rawHeightInch || !gsm) {
      return res.status(400).json({
        success: false,
        message: "Sheet Size (Width & Height) and GSM are required.",
      });
    }

    const cleanType = String(paperType || "General").trim();
    const cleanColour = String(colour || "White").trim();
    const code = `PAP-${Number(rawWidthInch)}x${Number(rawHeightInch)}-${Number(gsm)}-${cleanType.toUpperCase().slice(0, 4)}-${cleanColour.toUpperCase().slice(0, 3)}-${Date.now().toString().slice(-4)}`;

    const paper = await PaperMaster.create({
      code,
      rawWidthInch: Number(rawWidthInch),
      rawHeightInch: Number(rawHeightInch),
      paperType: cleanType,
      gsm: Number(gsm),
      colour: cleanColour,
      looseSheetRate: Number(looseSheetRate) || 0,
      reamRate: Number(reamRate) || 0,
      description: description || `${cleanType} paper ${rawWidthInch}"x${rawHeightInch}" ${gsm} GSM ${cleanColour}`,
      isActive: true,
    });

    const now = new Date();
    const rate = await PaperRate.create({
      paperId: paper._id,
      paperCode: paper.code,
      looseSheetRate: Number(looseSheetRate) || 0,
      reamRate: Number(reamRate) || 0,
      isProvisional: false,
      effectiveFrom: now,
      effectiveTill: null,
      updatedBy: req.user?.username || "admin",
      remarks: "Initial paper creation via Admin Panel",
    });

    return res.status(201).json({
      success: true,
      message: `Sheet ${rawWidthInch}"x${rawHeightInch}" ${cleanType} ${gsm} GSM added successfully!`,
      data: {
        ...paper.toObject(),
        rawSheetWidth: paper.rawWidthInch,
        rawHeightInch: paper.rawHeightInch,
        activeRate: rate,
        currentRate: {
          looseRatePerSheet: rate.looseSheetRate,
          reamRate: rate.reamRate,
          effectiveFrom: rate.effectiveFrom,
        },
      },
    });
  } catch (error) {
    console.error("Create Paper Master error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/masters/papers/:id (Update Sheet properties and rates)
export async function updatePaperMaster(req, res) {
  try {
    const { id } = req.params;
    const {
      rawWidthInch,
      rawHeightInch,
      paperType,
      gsm,
      colour,
      looseSheetRate,
      reamRate,
      description,
    } = req.body || {};

    const paper = await PaperMaster.findById(id);
    if (!paper) {
      return res.status(404).json({ success: false, message: "Sheet not found." });
    }

    if (rawWidthInch !== undefined) paper.rawWidthInch = Number(rawWidthInch);
    if (rawHeightInch !== undefined) paper.rawHeightInch = Number(rawHeightInch);
    if (paperType !== undefined) paper.paperType = String(paperType).trim();
    if (gsm !== undefined) {
      paper.gsm = Number(gsm);
      paper.gsmLabel = `${paper.gsm} GSM`;
    }
    if (colour !== undefined) paper.colour = String(colour).trim();
    if (looseSheetRate !== undefined) paper.looseSheetRate = Number(looseSheetRate);
    if (reamRate !== undefined) paper.reamRate = Number(reamRate);
    if (description !== undefined) paper.description = description;

    await paper.save();

    let activeRate = await PaperRate.findOne({ paperId: id, effectiveTill: null });
    if (looseSheetRate !== undefined || reamRate !== undefined) {
      const now = new Date();
      await PaperRate.updateMany(
        { paperId: id, effectiveTill: null },
        { $set: { effectiveTill: now } }
      );

      activeRate = await PaperRate.create({
        paperId: paper._id,
        paperCode: paper.code,
        looseSheetRate: looseSheetRate !== undefined ? Number(looseSheetRate) : (activeRate?.looseSheetRate || 0),
        reamRate: reamRate !== undefined ? Number(reamRate) : (activeRate?.reamRate || 0),
        isProvisional: false,
        effectiveFrom: now,
        effectiveTill: null,
        updatedBy: req.user?.username || "admin",
        remarks: "Updated via Admin Panel",
      });
    }

    return res.json({
      success: true,
      message: "Sheet updated successfully.",
      data: {
        ...paper.toObject(),
        rawSheetWidth: paper.rawWidthInch,
        rawHeightInch: paper.rawHeightInch,
        activeRate,
        currentRate: activeRate
          ? {
              looseRatePerSheet: activeRate.looseSheetRate,
              reamRate: activeRate.reamRate,
              effectiveFrom: activeRate.effectiveFrom,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Update Paper Master error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE /api/masters/papers/:id (Deactivate Sheet)
export async function deletePaperMaster(req, res) {
  try {
    const { id } = req.params;
    const paper = await PaperMaster.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );
    if (!paper) {
      return res.status(404).json({ success: false, message: "Sheet not found." });
    }
    return res.json({ success: true, message: "Sheet deleted successfully." });
  } catch (error) {
    console.error("Delete Paper Master error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/masters/papers/rate (Admin Only - Versioned Update)
export async function updatePaperRate(req, res) {
  try {
    const { paperId, looseSheetRate, reamRate, remarks } = req.body || {};
    if (!paperId || looseSheetRate === undefined || reamRate === undefined) {
      return res.status(400).json({
        success: false,
        message: "paperId, looseSheetRate, and reamRate are required.",
      });
    }

    const paper = await PaperMaster.findById(paperId);
    if (!paper) {
      return res.status(404).json({ success: false, message: "Paper not found." });
    }

    paper.looseSheetRate = Number(looseSheetRate);
    paper.reamRate = Number(reamRate);
    await paper.save();

    const now = new Date();

    // 1. Close out previous active rate version
    await PaperRate.updateMany(
      { paperId, effectiveTill: null },
      { $set: { effectiveTill: now } }
    );

    // 2. Create new active version with audit trail
    const newRate = await PaperRate.create({
      paperId,
      paperCode: paper.code,
      looseSheetRate: Number(looseSheetRate),
      reamRate: Number(reamRate),
      isProvisional: false,
      effectiveFrom: now,
      effectiveTill: null,
      updatedBy: req.user?.username || "admin",
      remarks: remarks || "Rate update by Admin",
    });

    return res.json({
      success: true,
      message: `Paper rate updated with version tracking for ${paper.code}`,
      data: newRate,
    });
  } catch (error) {
    console.error("Update Paper Rate error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ----------------- PRINTING RATES (MINI OFFSET & DIGITAL) -----------------

// GET /api/masters/printing-rates
export async function getPrintingRates(req, res) {
  try {
    const { processType } = req.query;
    const query = { isActive: true };
    if (processType) query.processType = processType;

    const rates = await PrintingRateMaster.find(query).sort({ processType: 1, rateKey: 1 }).lean();
    return res.json({ success: true, count: rates.length, data: rates });
  } catch (error) {
    console.error("Get Printing Rates error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/masters/printing-rates/:rateKey (Admin Only)
export async function updatePrintingRate(req, res) {
  try {
    const { rateKey } = req.params;
    const { rate, description } = req.body || {};
    if (rate === undefined || isNaN(Number(rate))) {
      return res.status(400).json({ success: false, message: "Valid rate is required." });
    }

    const updated = await PrintingRateMaster.findOneAndUpdate(
      { rateKey },
      { $set: { rate: Number(rate), ...(description ? { description } : {}) } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Printing rate key not found." });
    }

    return res.json({ success: true, message: `Printing rate ${rateKey} updated.`, data: updated });
  } catch (error) {
    console.error("Update Printing Rate error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ----------------- BINDING & FINISHING RATES -----------------

// GET /api/masters/binding-rates
export async function getBindingRates(req, res) {
  try {
    const rates = await BindingRateMaster.find({ isActive: true }).sort({ bindingType: 1 }).lean();
    return res.json({ success: true, count: rates.length, data: rates });
  } catch (error) {
    console.error("Get Binding Rates error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/masters/binding-rates/:bindingCode (Admin Only)
export async function updateBindingRate(req, res) {
  try {
    const { bindingCode } = req.params;
    const { ratePerUnit } = req.body || {};
    if (ratePerUnit === undefined || isNaN(Number(ratePerUnit))) {
      return res.status(400).json({ success: false, message: "Valid ratePerUnit is required." });
    }

    const updated = await BindingRateMaster.findOneAndUpdate(
      { bindingCode: bindingCode.toUpperCase() },
      { $set: { ratePerUnit: Number(ratePerUnit) } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Binding rate code not found." });
    }

    return res.json({ success: true, message: `Binding rate updated.`, data: updated });
  } catch (error) {
    console.error("Update Binding Rate error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/masters/finishing-rates
export async function getFinishingRates(req, res) {
  try {
    const rates = await FinishingRateMaster.find({ isActive: true }).sort({ serviceType: 1 }).lean();
    return res.json({ success: true, count: rates.length, data: rates });
  } catch (error) {
    console.error("Get Finishing Rates error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PUT /api/masters/finishing-rates/:serviceKey (Admin Only)
export async function updateFinishingRate(req, res) {
  try {
    const { serviceKey } = req.params;
    const { ratePerBook } = req.body || {};
    if (ratePerBook === undefined || isNaN(Number(ratePerBook))) {
      return res.status(400).json({ success: false, message: "Valid ratePerBook is required." });
    }

    const updated = await FinishingRateMaster.findOneAndUpdate(
      { serviceKey: serviceKey.toUpperCase() },
      { $set: { ratePerBook: Number(ratePerBook) } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Finishing rate key not found." });
    }

    return res.json({ success: true, message: `Finishing rate updated.`, data: updated });
  } catch (error) {
    console.error("Update Finishing Rate error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
