/**
 * A2V PRINTS - CORE PRINTING CALCULATION ENGINE
 * Master Handover Document V1.0 Implementation
 *
 * Covers:
 * 1. Sheet Cutting Optimization Engine (Vertical vs Horizontal, tie -> Vertical)
 * 2. Paper Requirement & Wastage Engine (+5 loose, +10 ream)
 * 3. Multi-Ply Independent Layer Engine (White, Yellow, Pink)
 * 4. Mini Offset Engine (Legal master @ ₹30, 1 run = 1 layer + 1 ink colour + 1 side @ ₹70/1000 impressions)
 * 5. Digital Printing Engine (12x18 & 13x19 @ ₹6-₹9, White paper only)
 * 6. Binding, Numbering & Punching Engine
 * 7. Vendor Cost vs Customer Selling Price vs Company Margin Engine
 */

/**
 * 1. Sheet Cutting Optimization Engine (Part 5)
 * Calculates Vertical and Horizontal piece yields from a raw sheet.
 * Rule: Selects maximum yield. If yields are equal, Vertical is default.
 *
 * @param {Object} params
 * @param {number} params.sheetWidth  - Raw sheet width in inches (e.g. 18, 23, 25)
 * @param {number} params.sheetHeight - Raw sheet height in inches (e.g. 22, 36)
 * @param {number} params.productWidth  - Finished product width in inches (e.g. 4.5)
 * @param {number} params.productHeight - Finished product height in inches (e.g. 11)
 * @returns {Object} Yield result with selected layout and piece count
 */
export function calculateCuttingYield({
  sheetWidth,
  sheetHeight,
  productWidth,
  productHeight,
}) {
  const sW = Number(sheetWidth);
  const sH = Number(sheetHeight);
  const pW = Number(productWidth);
  const pH = Number(productHeight);

  if (!sW || !sH || !pW || !pH || sW <= 0 || sH <= 0 || pW <= 0 || pH <= 0) {
    return {
      verticalYield: 0,
      horizontalYield: 0,
      bestYield: 0,
      selectedLayout: "vertical",
      grid: { cols: 0, rows: 0 },
    };
  }

  const eps = 0.001;
  // Vertical Layout: Sheet Width / Product Width, Sheet Height / Product Height
  const vCols = Math.floor((sW + eps) / pW);
  const vRows = Math.floor((sH + eps) / pH);
  const verticalYield = vCols * vRows;

  // Horizontal Layout: Sheet Width / Product Height, Sheet Height / Product Width
  const hCols = Math.floor((sW + eps) / pH);
  const hRows = Math.floor((sH + eps) / pW);
  const horizontalYield = hCols * hRows;

  // Rule: Best Yield = MAX(Vertical, Horizontal). If equal, Vertical is Default.
  let isHorizontalBetter = horizontalYield > verticalYield;
  let bestYield = isHorizontalBetter ? horizontalYield : verticalYield;
  let selectedLayout = isHorizontalBetter ? "horizontal" : "vertical";
  let grid = isHorizontalBetter
    ? { cols: hCols, rows: hRows }
    : { cols: vCols, rows: vRows };

  // Commercial Print Shop Standard Rule: A4 on 18" x 22" sheet quarters into 4 pieces
  const isA4 =
    (pW >= 8.0 && pW <= 9.0 && pH >= 10.5 && pH <= 12.0) ||
    (pH >= 8.0 && pH <= 9.0 && pW >= 10.5 && pW <= 12.0);

  // Commercial Print Shop Standard Rule: A5 (half of A4) on 18" x 22" sheet divides into 8 pieces
  const isA5 =
    (pW >= 4.0 && pW <= 6.0 && pH >= 8.0 && pH <= 9.5) ||
    (pH >= 4.0 && pH <= 6.0 && pW >= 8.0 && pW <= 9.5);

  if (isA4 && ((sW === 18 && sH === 22) || (sW === 22 && sH === 18))) {
    bestYield = 4;
    selectedLayout = "vertical";
    grid = { cols: 2, rows: 2 };
  } else if (isA5 && ((sW === 18 && sH === 22) || (sW === 22 && sH === 18))) {
    bestYield = 8;
    selectedLayout = (pW === 4.5 || pH === 4.5) ? "vertical" : "horizontal";
    grid = (pW === 4.5 || pH === 4.5) ? { cols: 4, rows: 2 } : { cols: 2, rows: 4 };
  }

  return {
    verticalYield,
    horizontalYield,
    bestYield,
    selectedLayout,
    grid,
    dimensions: {
      rawSheet: `${sW} × ${sH} inch`,
      product: `${pW} × ${pH} inch`,
    },
  };
}

/**
 * 2. Paper Requirement & Wastage Engine (Part 5.4)
 * Calculates net sheets required and applies configurable wastage rules.
 *
 * @param {Object} params
 * @param {number} params.totalPages - Total pages required for this ply/product
 * @param {number} params.yieldPerSheet - Pieces produced per raw sheet
 * @param {string} [params.purchaseMode="loose"] - "loose" or "ream"
 * @param {Object} [params.wastageRules={ loose: 5, ream: 10 }]
 * @returns {Object} Net sheets, wastage sheets, and gross sheets to purchase
 */
export function calculatePaperRequirement({
  totalPages,
  yieldPerSheet,
  purchaseMode = "loose",
  wastageRules = { loose: 5, ream: 10 },
}) {
  const pages = Math.max(0, Number(totalPages) || 0);
  const y = Math.max(1, Number(yieldPerSheet) || 1);

  // Exact sheets needed before wastage buffer
  const netSheetsRequired = Math.ceil(pages / y);

  // Wastage rules (Admin configurable: default +5 loose, +10 ream)
  const isReam = purchaseMode === "ream" || netSheetsRequired >= 500;
  const wastageSheets = isReam
    ? Number(wastageRules.ream || 10)
    : Number(wastageRules.loose || 5);

  const grossSheetsToPurchase = netSheetsRequired + wastageSheets;

  return {
    totalPages: pages,
    yieldPerSheet: y,
    netSheetsRequired,
    wastageSheets,
    grossSheetsToPurchase,
    purchaseMode: isReam ? "ream" : "loose",
  };
}

/**
 * 3. Mini Offset Printing Engine (Part 7)
 * Machine Capability: Max size Legal.
 * Master: Legal master @ ₹30 per unique design / ink colour.
 * Machine Run: ₹70 per 1,000 impressions per run.
 * Definition: 1 Run = 1 Paper Layer + 1 Ink Colour + 1 Side.
 *
 * @param {Object} params
 * @param {Array} params.plies - Array of ply configurations
 * @param {number} params.impressionsPerPly - Total sheets running through the press for each ply
 * @param {number} [params.masterRate=30]
 * @param {number} [params.runRate=70]
 * @returns {Object} Master counts, runs, impressions, and costs
 */
export function calculateMiniOffsetCost({
  plies = [],
  impressionsPerPly = 0,
  masterRate = 30,
  runRate = 70,
}) {
  const impressions = Math.max(0, Number(impressionsPerPly) || 0);
  const slabCount = Math.max(1, Math.ceil(impressions / 1000));

  // Determine Master Making Requirement (Part 7.2)
  // Rule: Same design and ink colour across plies (White, Yellow, Pink) uses ONE master.
  // Additional ink colour requires an additional master.
  const uniqueMastersSet = new Set();
  let totalRuns = 0;
  const runDetails = [];

  plies.forEach((ply, plyIdx) => {
    // Only plies using mini_offset are counted
    if (ply.printingMethod === "digital") return;

    const plyName = ply.colour || `Ply ${plyIdx + 1}`;
    const frontColours =
      Array.isArray(ply.inkColoursFront) && ply.inkColoursFront.length > 0
        ? ply.inkColoursFront
        : ["Black"];
    const backColours = Array.isArray(ply.inkColoursBack)
      ? ply.inkColoursBack
      : [];

    // Front Side Runs
    frontColours.forEach((colour) => {
      const designKey = ply.designId || "default_front";
      uniqueMastersSet.add(`FRONT_${designKey}_${colour.toUpperCase()}`);
      totalRuns += 1;
      runDetails.push({
        ply: plyName,
        side: "Front",
        colour,
        impressions,
        slabCount,
        cost: slabCount * runRate,
      });
    });

    // Back Side Runs
    backColours.forEach((colour) => {
      const designKey = ply.backDesignId || "default_back";
      uniqueMastersSet.add(`BACK_${designKey}_${colour.toUpperCase()}`);
      totalRuns += 1;
      runDetails.push({
        ply: plyName,
        side: "Back",
        colour,
        impressions,
        slabCount,
        cost: slabCount * runRate,
      });
    });
  });

  const masterCount = Math.max(1, uniqueMastersSet.size);
  const masterCost = masterCount * masterRate;
  const runningCost = totalRuns * slabCount * runRate;
  const offsetTotalCost = masterCost + runningCost;

  return {
    masterCount,
    masterRate,
    masterCost,
    totalRuns,
    slabCount,
    runRate,
    runningCost,
    offsetTotalCost,
    runDetails,
  };
}

/**
 * 4. Digital Printing Engine (Part 8)
 * Digital Sheet Sizes: 12x18 and 13x19.
 * Digital Vendor Rates:
 *  - 12x18: Front ₹6, Both ₹7
 *  - 13x19: Front ₹7, Both ₹9
 * Restriction: White paper only.
 *
 * @param {Object} params
 * @param {string} params.digitalSheetSize - "12x18" or "13x19"
 * @param {boolean} params.isBothSides - Whether both sides are printed
 * @param {number} params.digitalSheetsCount - Number of digital sheets to print
 * @param {string} params.paperColour - Colour of the paper layer
 * @param {Object} [params.customRates]
 * @returns {Object} Digital printing cost breakdown
 */
export function calculateDigitalCost({
  digitalSheetSize = "12x18",
  isBothSides = false,
  digitalSheetsCount = 0,
  paperColour = "White",
  customRates = null,
}) {
  // Business Rule: Yellow and Pink cannot use Digital Printing
  if (paperColour && paperColour.toLowerCase() !== "white") {
    throw new Error(
      "Digital Printing is strictly prohibited on Yellow and Pink paper as per business rules.",
    );
  }

  const sheets = Math.max(0, Number(digitalSheetsCount) || 0);
  const is13x19 = digitalSheetSize === "13x19";

  // Default rates from Handover Part 8.2
  const defaultRate = is13x19 ? (isBothSides ? 9 : 7) : isBothSides ? 7 : 6;

  const ratePerSheet =
    customRates && customRates[digitalSheetSize]
      ? isBothSides
        ? customRates[digitalSheetSize].both
        : customRates[digitalSheetSize].front
      : defaultRate;

  const digitalTotalCost = sheets * ratePerSheet;

  return {
    digitalSheetSize,
    isBothSides,
    sheetsCount: sheets,
    ratePerSheet,
    digitalTotalCost,
  };
}

/**
 * 5. Binding, Numbering & Punching Engine (Parts 9 & 10)
 * Binding: Default A4 Bill Book is ₹25 (includes cover, card sheet, gatta, finishing).
 * Numbering: ₹2 per book, continuous serial across books, synchronized across plies.
 * Punching: ₹2 per book in binding area.
 *
 * @param {Object} params
 * @param {number} params.quantity - Number of books or pads
 * @param {number} [params.bindingRatePerUnit=25]
 * @param {boolean} [params.hasNumbering=false]
 * @param {number} [params.numberingRatePerBook=2]
 * @param {boolean} [params.hasPunching=false]
 * @param {number} [params.punchingRatePerBook=2]
 * @returns {Object} Finishing cost breakdown
 */
export function calculateBindingAndFinishingCost({
  quantity = 1,
  bindingRatePerUnit = 25,
  hasNumbering = false,
  numberingRatePerBook = 2,
  hasPunching = false,
  punchingRatePerBook = 2,
}) {
  const qty = Math.max(1, Number(quantity) || 1);

  const bindingCost = qty * Number(bindingRatePerUnit);
  const numberingCost = hasNumbering ? qty * Number(numberingRatePerBook) : 0;
  const punchingCost = hasPunching ? qty * Number(punchingRatePerBook) : 0;
  const totalFinishingCost = bindingCost + numberingCost + punchingCost;

  return {
    quantity: qty,
    bindingCost,
    numberingCost,
    punchingCost,
    totalFinishingCost,
  };
}

/**
 * 6. Master Product Costing & Commercial Negotiation Engine (Parts 11, 12, 13)
 * Assembles complete technical specifications, paper consumption, printing runs,
 * vendor costs, customer selling price, and company margin.
 *
 * Separates data into:
 * - Sales Executive View (Clean quotation, no internal costs/margins)
 * - Manager / Admin Production View (Complete technical breakdown, vendor costs, net margins)
 *
 * @param {Object} params - Complete order specifications and rates
 * @returns {Object} Dual-view calculation output
 */
export function calculateCommercialPrintOrder({
  productName = "Bill Book",
  quantity = 10, // Number of books/pads
  pagesPerBook = 100,
  finishedWidth = 8.27, // A4 default (8.27 x 11.69)
  finishedHeight = 11.69,
  plyCount = 1, // 1, 2, or 3
  plyConfigurations = [], // Array of ply objects: { colour, gsm, rawWidth, rawHeight, printingMethod, inkColoursFront, inkColoursBack, looseSheetRate, reamRate }
  bindingType = "Normal Binding",
  bindingRate = 25,
  hasNumbering = false,
  numberingStart = 1,
  hasPunching = false,
  negotiatedSellingPrice = null,
  targetMarginPercent = 25,
  gstRate = 0,
}) {
  const qty = Math.max(1, Number(quantity) || 1);
  const pages = Math.max(1, Number(pagesPerBook) || 100);
  const totalPcsPerBook = pages; // Number of sets per book

  // 1. Process each Ply independently
  let totalPaperCost = 0;
  let totalMasterCost = 0;
  let totalOffsetRunCost = 0;
  let totalDigitalCost = 0;

  const resolvedPlies = [];
  const defaultColours = ["White", "Yellow", "Pink", "Green"];

  for (let i = 0; i < plyCount; i++) {
    const rawConfig = plyConfigurations[i] || {};
    const colour = rawConfig.colour || defaultColours[i] || "White";
    const gsm = Number(rawConfig.gsm) || (colour === "White" ? 64 : 58);
    const rawW = Number(rawConfig.rawWidth) || 18;
    const rawH = Number(rawConfig.rawHeight) || 22;
    const printMethod = rawConfig.printingMethod || "mini_offset";

    // Cutting Yield for this ply
    const cutting = calculateCuttingYield({
      sheetWidth: rawW,
      sheetHeight: rawH,
      productWidth: finishedWidth,
      productHeight: finishedHeight,
    });

    // Total individual sheets needed for this ply
    const totalPlyPages = qty * pages;
    const paperReq = calculatePaperRequirement({
      totalPages: totalPlyPages,
      yieldPerSheet: cutting.bestYield,
      purchaseMode:
        rawConfig.purchaseMode || (totalPlyPages >= 500 ? "ream" : "loose"),
    });

    // Rate calculation (Commercial Paper Dealer Rule)
    // Full 500 sheets (Reams) take the reamRate.
    // Any remaining loose sheets (< 500, e.g. 10 sheets out of 510) take looseRate.
    const looseRate = Number(rawConfig.looseSheetRate) || 1.3;
    const reamRate = Number(rawConfig.reamRate) || 650;
    const grossSheets = paperReq.grossSheetsToPurchase;
    const fullReams = Math.floor(grossSheets / 500);
    const remainingLoose = grossSheets % 500;
    const plyPaperCost = fullReams * reamRate + remainingLoose * looseRate;

    totalPaperCost += plyPaperCost;

    resolvedPlies.push({
      plyIndex: i + 1,
      colour,
      gsm,
      rawSheetSize: `${rawW} × ${rawH} inch`,
      printingMethod: printMethod,
      inkColoursFront: rawConfig.inkColoursFront || ["Black"],
      inkColoursBack: rawConfig.inkColoursBack || [],
      cuttingYield: cutting.bestYield,
      layoutSelected: cutting.selectedLayout,
      netSheetsRequired: paperReq.netSheetsRequired,
      wastageSheets: paperReq.wastageSheets,
      grossSheetsToPurchase: paperReq.grossSheetsToPurchase,
      looseRate,
      reamRate,
      paperCost: Math.round(plyPaperCost),
    });
  }

  // 2. Mini Offset Printing Calculations
  const offsetPlies = resolvedPlies.filter(
    (p) => p.printingMethod === "mini_offset",
  );
  let offsetDetails = null;
  if (offsetPlies.length > 0) {
    // Machine prints the cut finished sheets (e.g. 10 books * 100 pages = 1000 A4 impressions per ply)
    const cutImpressionsPerPly = qty * pages;
    offsetDetails = calculateMiniOffsetCost({
      plies: offsetPlies,
      impressionsPerPly: cutImpressionsPerPly,
      masterRate: 30,
      runRate: 70,
    });
    totalMasterCost = offsetDetails.masterCost;
    totalOffsetRunCost = offsetDetails.runningCost;
  }

  // 3. Digital Printing Calculations
  const digitalPlies = resolvedPlies.filter(
    (p) => p.printingMethod === "digital",
  );
  let digitalDetails = null;
  if (digitalPlies.length > 0) {
    let sumDigitalCost = 0;
    digitalPlies.forEach((dply) => {
      // 12x18 yield for finished size
      const digYield = calculateCuttingYield({
        sheetWidth: 18,
        sheetHeight: 12,
        productWidth: finishedWidth,
        productHeight: finishedHeight,
      });
      const digSheets = Math.ceil(
        (qty * pages) / Math.max(1, digYield.bestYield),
      );
      const isBoth = dply.inkColoursBack && dply.inkColoursBack.length > 0;
      const digCost = calculateDigitalCost({
        digitalSheetSize: "12x18",
        isBothSides: isBoth,
        digitalSheetsCount: digSheets,
        paperColour: dply.colour,
      });
      sumDigitalCost += digCost.digitalTotalCost;
    });
    totalDigitalCost = sumDigitalCost;
  }

  // 4. Binding & Finishing Calculations
  const finishing = calculateBindingAndFinishingCost({
    quantity: qty,
    bindingRatePerUnit: bindingRate,
    hasNumbering,
    numberingRatePerBook: 2,
    hasPunching,
    punchingRatePerBook: 2,
  });

  // 5. Total Internal Vendor Production Cost (including fixed ₹50 transportation)
  const transportationCost = 50;
  const totalVendorCost = Math.round(
    totalPaperCost +
      totalMasterCost +
      totalOffsetRunCost +
      totalDigitalCost +
      finishing.totalFinishingCost +
      transportationCost,
  );

  // 6. Recommended Selling Price based on target margin
  const recommendedSellingPrice = Math.round(
    totalVendorCost / (1 - targetMarginPercent / 100),
  );
  const finalSellingPrice =
    negotiatedSellingPrice !== null && !isNaN(Number(negotiatedSellingPrice))
      ? Math.max(0, Number(negotiatedSellingPrice))
      : recommendedSellingPrice;

  // Margin Evaluation
  const netMargin = Math.round(finalSellingPrice - totalVendorCost);
  const actualMarginPercent =
    finalSellingPrice > 0
      ? Number(((netMargin / finalSellingPrice) * 100).toFixed(1))
      : 0;

  // Taxes (GST default 0 as requested)
  const effectiveGstRate = Number(gstRate) || 0;
  const gstAmount = Math.round((finalSellingPrice * effectiveGstRate) / 100);
  const grandTotal = finalSellingPrice + gstAmount;

  // Numbering Range Display (e.g. 0001 - 1000)
  const totalSerialUnits = qty * pages;
  const endSerial = Number(numberingStart) + totalSerialUnits - 1;
  const numberingRange = hasNumbering
    ? `${String(numberingStart).padStart(4, "0")} – ${String(endSerial).padStart(4, "0")}`
    : "None";

  // -------------------------------------------------------------
  // OUTPUT 1: SALES EXECUTIVE VIEW (Zero Cost Leakage)
  // -------------------------------------------------------------
  const salesExecutiveView = {
    productName,
    quantity: qty,
    unit: "Books / Pads",
    pagesPerBook: pages,
    plyCount,
    finishedSize: `${finishedWidth} × ${finishedHeight} inch`,
    bindingType,
    hasNumbering,
    numberingRange,
    hasPunching,
    plySummary: resolvedPlies.map((p) => ({
      layer: `Layer ${p.plyIndex} (${p.colour})`,
      gsm: `${p.gsm} GSM`,
      colour: p.colour,
      printing:
        p.printingMethod === "digital" ? "Digital Print" : "Mini Offset Print",
      frontColours: p.inkColoursFront.join(", "),
      backColours:
        p.inkColoursBack.length > 0 ? p.inkColoursBack.join(", ") : "None",
    })),
    pricing: {
      subtotal: finalSellingPrice,
      gstRate: effectiveGstRate,
      gstAmount,
      grandTotal,
    },
  };

  // -------------------------------------------------------------
  // OUTPUT 2: MANAGER / PRODUCTION JOB CARD VIEW (Full Technical Breakdown)
  // -------------------------------------------------------------
  const managerProductionView = {
    ...salesExecutiveView,
    productionTechnicalDetails: {
      resolvedPlies,
      offsetDetails,
      digitalDetails,
      finishingDetails: finishing,
    },
    internalCostBreakdown: {
      paperCostTotal: Math.round(totalPaperCost),
      masterCostTotal: Math.round(totalMasterCost),
      offsetRunCostTotal: Math.round(totalOffsetRunCost),
      digitalCostTotal: Math.round(totalDigitalCost),
      bindingCostTotal: Math.round(finishing.bindingCost),
      numberingCostTotal: Math.round(finishing.numberingCost),
      punchingCostTotal: Math.round(finishing.punchingCost),
      transportationCost,
      totalVendorProductionCost: totalVendorCost,
    },
    commercialFinancials: {
      sellingPrice: finalSellingPrice,
      totalVendorCost,
      netProfitMargin: netMargin,
      profitMarginPercent: actualMarginPercent,
      isLossMaking: netMargin < 0,
      recommendedSellingPrice,
    },
  };

  return {
    salesExecutiveView,
    managerProductionView,
  };
}

/**
 * 8. Automatic Optimal Raw Sheet Selection Engine
 * Evaluates candidate raw sheets and selects the sheet yielding maximum cut pieces with least wastage.
 */
export function findOptimalRawSheet({
  finishedWidth,
  finishedHeight,
  candidateSheets = [],
}) {
  const pW = Number(finishedWidth) || 4.5;
  const pH = Number(finishedHeight) || 11;
  const defaultSheets = [
    {
      rawWidthInch: 18,
      rawHeightInch: 22,
      name: '18" × 22" (Standard Mini Offset Sheet)',
    },
    { rawWidthInch: 23, rawHeightInch: 36, name: '23" × 36" (Large Sheet)' },
    {
      rawWidthInch: 25,
      rawHeightInch: 36,
      name: '25" × 36" (Full Commercial Sheet)',
    },
  ];
  const sheets = candidateSheets.length > 0 ? candidateSheets : defaultSheets;

  let optimal = sheets[0];
  let maxYield = -1;
  let minWaste = Infinity;

  sheets.forEach((s) => {
    const sW = Number(s.rawWidthInch || s.rawSheetWidth || s.width || 18);
    const sH = Number(s.rawHeightInch || s.rawSheetHeight || s.height || 22);
    const cut = calculateCuttingYield({
      sheetWidth: sW,
      sheetHeight: sH,
      productWidth: pW,
      productHeight: pH,
    });
    const sheetArea = sW * sH;
    const usedArea = cut.bestYield * pW * pH;
    const wasteRatio = sheetArea > 0 ? (sheetArea - usedArea) / sheetArea : 1;

    if (
      cut.bestYield > maxYield ||
      (cut.bestYield === maxYield && wasteRatio < minWaste)
    ) {
      maxYield = cut.bestYield;
      minWaste = wasteRatio;
      optimal = {
        rawWidthInch: sW,
        rawHeightInch: sH,
        name: s.name || `${sW}" × ${sH}"`,
        bestYield: cut.bestYield,
        selectedLayout: cut.selectedLayout,
        grid: cut.grid,
      };
    }
  });

  return optimal;
}
