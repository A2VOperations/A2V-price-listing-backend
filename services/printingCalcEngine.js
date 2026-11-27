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
      blocks: [],
      cutType: "single-grid",
      efficiency: 0,
      dimensions: {
        rawSheet: "0 × 0 inch",
        product: "0 × 0 inch",
      },
    };
  }

  const eps = 0.001;

  // 1. Pure Vertical Layout on given sheet (sW x sH)
  const vCols = Math.floor((sW + eps) / pW);
  const vRows = Math.floor((sH + eps) / pH);
  const verticalYield = vCols * vRows;

  // 2. Pure Horizontal Layout on given sheet (sW x sH)
  const hCols = Math.floor((sW + eps) / pH);
  const hRows = Math.floor((sH + eps) / pW);
  const horizontalYield = hCols * hRows;

  // Commercial Print Shop Standard Rule: A4 (8.27" x 11.69" ± 0.3") on 18" x 22" quarters into 4 pieces
  const isA4 =
    (Math.abs(pW - 8.27) <= 0.3 && Math.abs(pH - 11.69) <= 0.3) ||
    (Math.abs(pH - 8.27) <= 0.3 && Math.abs(pW - 11.69) <= 0.3);

  // Commercial Print Shop Standard Rule: A5 (5.83" x 8.27" ± 0.3") on 18" x 22" divides into 8 pieces
  const isA5 =
    (Math.abs(pW - 5.83) <= 0.3 && Math.abs(pH - 8.27) <= 0.3) ||
    (Math.abs(pH - 5.83) <= 0.3 && Math.abs(pW - 8.27) <= 0.3);

  const is18x22 = (sW === 18 && sH === 22) || (sW === 22 && sH === 18);

  if (isA4 && is18x22 && 4 * pW * pH <= sW * sH) {
    return {
      verticalYield: 4,
      horizontalYield: 2,
      bestYield: 4,
      selectedLayout: "vertical",
      grid: { cols: 2, rows: 2 },
      blocks: [
        {
          id: "Block 1",
          label: "A4 Standard Cut (4-Out)",
          count: 4,
          cols: 2,
          rows: 2,
          itemW: 9,
          itemH: 11,
          orientation: "vertical",
          x: 0,
          y: 0,
          width: 18,
          height: 22,
        },
      ],
      cutType: "single-grid",
      efficiency: Math.round(((4 * pW * pH) / (sW * sH)) * 1000) / 10,
      dimensions: {
        rawSheet: `${sW} × ${sH} inch`,
        product: `${pW} × ${pH} inch`,
      },
    };
  }

  if (isA5 && is18x22 && 8 * pW * pH <= sW * sH) {
    const isV = pW === 4.5 || pH === 4.5;
    return {
      verticalYield: 8,
      horizontalYield: 8,
      bestYield: 8,
      selectedLayout: isV ? "vertical" : "horizontal",
      grid: isV ? { cols: 4, rows: 2 } : { cols: 2, rows: 4 },
      blocks: [
        {
          id: "Block 1",
          label: "A5 Standard Cut (8-Out)",
          count: 8,
          cols: isV ? 4 : 2,
          rows: isV ? 2 : 4,
          itemW: isV ? 4.5 : 5.5,
          itemH: isV ? 11 : 9,
          orientation: isV ? "vertical" : "horizontal",
          x: 0,
          y: 0,
          width: 18,
          height: 22,
        },
      ],
      cutType: "single-grid",
      efficiency: Math.round(((8 * pW * pH) / (sW * sH)) * 1000) / 10,
      dimensions: {
        rawSheet: `${sW} × ${sH} inch`,
        product: `${pW} × ${pH} inch`,
      },
    };
  }

  // 3. Maximized Guillotine Combination Cutting Optimizer
  // Baseline: pure vertical or pure horizontal
  const isHorizBetter = horizontalYield > verticalYield;
  let best = {
    yield: isHorizBetter ? horizontalYield : verticalYield,
    selectedLayout: isHorizBetter ? "horizontal" : "vertical",
    cutType: "single-grid",
    grid: isHorizBetter ? { cols: hCols, rows: hRows } : { cols: vCols, rows: vRows },
    sheetW: sW,
    sheetH: sH,
    blocks: [
      {
        id: "Block 1",
        label: isHorizBetter ? "Horizontal Grid" : "Vertical Grid",
        count: isHorizBetter ? horizontalYield : verticalYield,
        cols: isHorizBetter ? hCols : vCols,
        rows: isHorizBetter ? hRows : vRows,
        itemW: isHorizBetter ? pH : pW,
        itemH: isHorizBetter ? pW : pH,
        orientation: isHorizBetter ? "horizontal" : "vertical",
        x: 0,
        y: 0,
        width: isHorizBetter ? hCols * pH : vCols * pW,
        height: isHorizBetter ? hRows * pW : vRows * pH,
      },
    ],
  };

  // Test both sheet orientations on the cutter bed: (sW x sH) and transposed (sH x sW)
  const sheetOrientations = [
    { w: Math.max(sW, sH), h: Math.min(sW, sH) },
    { w: Math.min(sW, sH), h: Math.max(sW, sH) },
  ];

  for (const s of sheetOrientations) {
    const W = s.w;
    const H = s.h;

    // Test both initial item orientations:
    // orient 0: itemA = pW x pH, itemB = pH x pW
    // orient 1: itemA = pH x pW, itemB = pW x pH
    for (let orient = 0; orient < 2; orient++) {
      const wA = orient === 0 ? pW : pH;
      const hA = orient === 0 ? pH : pW;
      const wB = hA;
      const hB = wA;

      // Pattern A: Horizontal Primary Cut across W at y = H1
      const maxR1 = Math.floor((H + eps) / hA);
      for (let r1 = 1; r1 <= maxR1; r1++) {
        const H1 = r1 * hA;
        const c1 = Math.floor((W + eps) / wA);
        const count1 = r1 * c1;

        const remH = H - H1;
        const r2 = Math.floor((remH + eps) / hB);
        const c2 = Math.floor((W + eps) / wB);
        const count2 = r2 * c2;

        const total = count1 + count2;
        if (total > best.yield) {
          best = {
            yield: total,
            selectedLayout: count2 > 0 ? "combination" : (orient === 0 ? "vertical" : "horizontal"),
            cutType: count2 > 0 ? "horizontal-split" : "single-grid",
            grid: { cols: Math.max(c1, c2), rows: r1 + r2 },
            sheetW: W,
            sheetH: H,
            blocks: [
              {
                id: "Block 1 (Top)",
                label: `Top: ${count1} Pcs (${orient === 0 ? "Vertical" : "Horizontal"} ${wA}×${hA}")`,
                count: count1,
                cols: c1,
                rows: r1,
                itemW: wA,
                itemH: hA,
                orientation: orient === 0 ? "vertical" : "horizontal",
                x: 0,
                y: 0,
                width: c1 * wA,
                height: H1,
              },
              ...(count2 > 0
                ? [
                    {
                      id: "Block 2 (Bottom)",
                      label: `Bottom: ${count2} Pcs (${orient === 0 ? "Horizontal" : "Vertical"} ${wB}×${hB}")`,
                      count: count2,
                      cols: c2,
                      rows: r2,
                      itemW: wB,
                      itemH: hB,
                      orientation: orient === 0 ? "horizontal" : "vertical",
                      x: 0,
                      y: H1,
                      width: c2 * wB,
                      height: r2 * hB,
                    },
                  ]
                : []),
            ],
          };
        }
      }

      // Pattern B: Vertical Primary Cut down H at x = W1
      const maxC1 = Math.floor((W + eps) / wA);
      for (let c1 = 1; c1 <= maxC1; c1++) {
        const W1 = c1 * wA;
        const r1 = Math.floor((H + eps) / hA);
        const count1 = c1 * r1;

        const remW = W - W1;
        const c2 = Math.floor((remW + eps) / wB);
        const r2 = Math.floor((H + eps) / hB);
        const count2 = c2 * r2;

        const total = count1 + count2;
        if (total > best.yield) {
          best = {
            yield: total,
            selectedLayout: count2 > 0 ? "combination" : (orient === 0 ? "vertical" : "horizontal"),
            cutType: count2 > 0 ? "vertical-split" : "single-grid",
            grid: { cols: c1 + c2, rows: Math.max(r1, r2) },
            sheetW: W,
            sheetH: H,
            blocks: [
              {
                id: "Block 1 (Left)",
                label: `Left: ${count1} Pcs (${orient === 0 ? "Vertical" : "Horizontal"} ${wA}×${hA}")`,
                count: count1,
                cols: c1,
                rows: r1,
                itemW: wA,
                itemH: hA,
                orientation: orient === 0 ? "vertical" : "horizontal",
                x: 0,
                y: 0,
                width: W1,
                height: r1 * hA,
              },
              ...(count2 > 0
                ? [
                    {
                      id: "Block 2 (Right)",
                      label: `Right: ${count2} Pcs (${orient === 0 ? "Horizontal" : "Vertical"} ${wB}×${hB}")`,
                      count: count2,
                      cols: c2,
                      rows: r2,
                      itemW: wB,
                      itemH: hB,
                      orientation: orient === 0 ? "horizontal" : "vertical",
                      x: W1,
                      y: 0,
                      width: c2 * wB,
                      height: r2 * hB,
                    },
                  ]
                : []),
            ],
          };
        }
      }
    }
  }

  const efficiency = Math.round(((best.yield * pW * pH) / (sW * sH)) * 1000) / 10;

  return {
    verticalYield,
    horizontalYield,
    bestYield: best.yield,
    selectedLayout: best.selectedLayout,
    cutType: best.cutType,
    grid: best.grid,
    blocks: best.blocks,
    efficiency,
    cuttingSheetDimensions: {
      width: best.sheetW,
      height: best.sheetH,
    },
    dimensions: {
      rawSheet: `${sW} × ${sH} inch`,
      product: `${pW} × ${pH} inch`,
    },
  };
}

/**
 * 2. Paper Requirement & Wastage Engine (Part 5.4)
 */
export const ELIGIBLE_CONSOLIDATION_STATUSES = new Set([
  "confirmed",
  "approved",
  "job_created",
  "created",
  "paper_requisition",
  "in_printing",
  "in_binding_numbering",
  "ready_for_dispatch",
]);

/**
 * Normalizes raw sheet dimensions from numeric width/height or string formats
 * (e.g. "18x22", "18 × 22 inch", "18\" x 22\"") into a canonical representation.
 */
export function normalizeRawSheetSize(rawWidth, rawHeight, rawSheetSizeStr) {
  let w = Number(rawWidth);
  let h = Number(rawHeight);
  if ((!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) && rawSheetSizeStr) {
    const nums = String(rawSheetSizeStr).match(/\d+(?:\.\d+)?/g);
    if (nums && nums.length >= 2) {
      w = Number(nums[0]);
      h = Number(nums[1]);
    }
  }
  w = Number.isFinite(w) && w > 0 ? w : 18;
  h = Number.isFinite(h) && h > 0 ? h : 22;
  return {
    rawWidth: w,
    rawHeight: h,
    rawSheetSize: `${w} × ${h} inch`,
    normalizedSizeKey: `${w}x${h}`,
  };
}

/**
 * Builds a normalized paper-group identity key from sheet dimensions, paper type, GSM, and colour.
 */
export function buildNormalizedPaperKey({
  rawWidth,
  rawHeight,
  rawSheetSize,
  paperType = "Maplitho",
  gsm = 70,
  colour = "White",
}) {
  const size = normalizeRawSheetSize(rawWidth, rawHeight, rawSheetSize);
  const normType = String(paperType || "Maplitho").trim().replace(/\s+/g, " ");
  const normGsm = Number(gsm) || 70;
  const normColour = String(colour || "White").trim().replace(/\s+/g, " ");
  const key = `${size.normalizedSizeKey}|${normType.toLowerCase()}|${normGsm}|${normColour.toLowerCase()}`;
  return {
    key,
    rawWidth: size.rawWidth,
    rawHeight: size.rawHeight,
    rawSheetSize: size.rawSheetSize,
    paperType: normType,
    gsm: normGsm,
    colour: normColour,
  };
}

/**
 * Reusable Wastage Helper (Approved Business Rule):
 * - netSheets === 0 -> 0 wastage
 * - 0 < netSheets < 500 -> +5 loose wastage
 * - netSheets >= 500 -> flat +10 ream wastage
 */
export function calculateGroupWastage(
  netSheets,
  wastageRules = { loose: 5, ream: 10 },
) {
  const net = Math.max(0, Number(netSheets) || 0);
  if (net === 0) return 0;
  return net >= 500
    ? Number(wastageRules?.ream ?? 10)
    : Number(wastageRules?.loose ?? 5);
}

/**
 * Reusable Ream + Loose Paper Cost Helper (1 Ream = 500 sheets).
 */
export function calculateReamAndLooseCost(grossSheets, reamRate, looseRate) {
  const gross = Math.max(0, Number(grossSheets) || 0);
  const reams = Math.floor(gross / 500);
  const looseSheets = gross % 500;
  const reamCost = reams * Number(reamRate);
  const looseCost = looseSheets * Number(looseRate);
  const totalCost = Math.round(reamCost + looseCost);
  return {
    grossSheets: gross,
    reams,
    looseSheets,
    reamCost,
    looseCost,
    totalCost,
  };
}

/**
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
  const rawYield = Number(yieldPerSheet);
  if (!Number.isFinite(rawYield) || rawYield <= 0) {
    throw new Error("Product dimensions exceed raw sheet size (cutting yield is 0).");
  }
  const y = rawYield;

  if (pages === 0) {
    return {
      totalPages: 0,
      yieldPerSheet: y,
      netSheetsRequired: 0,
      wastageSheets: 0,
      grossSheetsToPurchase: 0,
      purchaseMode: "loose",
    };
  }

  // Exact sheets needed before wastage buffer
  const netSheetsRequired = Math.ceil(pages / y);

  // Threshold strictly based on NET sheets (0 -> 0, < 500 -> +5, >= 500 -> flat +10)
  const wastageSheets = calculateGroupWastage(netSheetsRequired, wastageRules);
  const grossSheetsToPurchase = netSheetsRequired + wastageSheets;
  const isReam = netSheetsRequired >= 500;

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

  // Determine Master Making Requirement (Part 7.2)
  // Rule: Same design and ink colour across plies (White, Yellow, Pink) uses ONE master.
  // Additional ink colour requires an additional master.
  const uniqueMastersSet = new Set();
  let totalRuns = 0;
  const runDetails = [];

  if (impressions === 0) {
    return {
      masterCount: 0,
      masterRate,
      masterCost: 0,
      totalRuns: 0,
      slabCount: 0,
      runRate,
      runningCost: 0,
      offsetTotalCost: 0,
      runDetails: [],
    };
  }

  const slabCount = Math.max(1, Math.ceil(impressions / 1000));

  plies.forEach((ply, plyIdx) => {
    // Only plies requiring printing and using mini_offset are counted
    if (ply.printRequired === false || ply.printingMethod === "digital") return;

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

  if (totalRuns === 0) {
    return {
      masterCount: 0,
      masterRate,
      masterCost: 0,
      totalRuns: 0,
      slabCount: 0,
      runRate,
      runningCost: 0,
      offsetTotalCost: 0,
      runDetails: [],
    };
  }

  const masterCount = uniqueMastersSet.size;
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
  // Business Rule: Digital Printing is strictly restricted to White paper only
  if (!paperColour || String(paperColour).trim().toLowerCase() !== "white") {
    throw new Error(
      "Digital Printing is strictly restricted to White paper only as per business rules.",
    );
  }

  if (!["12x18", "13x19"].includes(digitalSheetSize)) {
    throw new Error(
      `Unsupported digital sheet size '${digitalSheetSize}'. Supported sizes are '12x18' and '13x19'.`,
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
  plyConfigurations = [], // Array of ply objects: { colour, gsm, rawWidth, rawHeight, paperType, printingMethod, digitalSheetSize, inkColoursFront, inkColoursBack, looseSheetRate, reamRate }
  bindingType = "Normal Binding",
  bindingRate = 25,
  hasNumbering = false,
  numberingStart = 1,
  hasPunching = false,
  negotiatedSellingPrice = null,
  targetMarginPercent = 25,
  gstRate = 0,
  masterRates = {},
}) {
  const qty = Math.max(1, Number(quantity) || 1);
  const pages = Math.max(1, Number(pagesPerBook) || 100);
  const marginPct = Number(targetMarginPercent ?? 25);
  if (marginPct < 0 || marginPct >= 100) {
    throw new Error("targetMarginPercent must be between 0 and < 100.");
  }

  const effectiveMasterRate = Number(masterRates?.masterRate ?? 30);
  const effectiveRunRate = Number(masterRates?.runRate ?? 70);
  const effectiveNumberingRate = Number(masterRates?.numberingRatePerBook ?? 2);
  const effectivePunchingRate = Number(masterRates?.punchingRatePerBook ?? 2);
  const effectiveTransportCost = Number(masterRates?.transportationCost ?? 50);
  const effectiveWastageRules = masterRates?.wastageRules || { loose: 5, ream: 10 };
  const effectiveDigitalRates = masterRates?.digitalRates || null;

  // 1. Process each Ply & group identical papers for 500-sheet Ream + Loose purchasing
  let totalPaperCost = 0;
  let totalMasterCost = 0;
  let totalOffsetRunCost = 0;
  let totalDigitalCost = 0;

  const resolvedPlies = [];
  const paperGroups = new Map();
  const defaultColours = ["White", "Yellow", "Pink", "Green"];

  for (let i = 0; i < plyCount; i++) {
    const rawConfig = plyConfigurations[i] || {};
    const colour = rawConfig.colour || defaultColours[i] || "White";
    const paperType = rawConfig.paperType || "Maplitho";
    const gsm = Number(rawConfig.gsm ?? (colour === "White" ? 64 : 58));
    const rawW = Number(rawConfig.rawWidth ?? 18);
    const rawH = Number(rawConfig.rawHeight ?? 22);
    const printMethod = rawConfig.printingMethod || "mini_offset";
    const digitalSheetSize = rawConfig.digitalSheetSize || "12x18";

    // Cutting Yield for this ply
    const cutting = calculateCuttingYield({
      sheetWidth: rawW,
      sheetHeight: rawH,
      productWidth: finishedWidth,
      productHeight: finishedHeight,
    });

    // 1. Calculate net sheets separately for this ply
    const totalPlyPages = qty * pages;
    if (!Number.isFinite(cutting.bestYield) || cutting.bestYield <= 0) {
      throw new Error("Product dimensions exceed raw sheet size (cutting yield is 0).");
    }
    const netSheetsRequired =
      totalPlyPages === 0 ? 0 : Math.ceil(totalPlyPages / cutting.bestYield);

    // 2. Normalize paper specifications & group identical papers within this order
    const looseRate = Number(rawConfig.looseSheetRate ?? 1.3);
    const reamRate = Number(rawConfig.reamRate ?? 650);
    const normPaper = buildNormalizedPaperKey({
      rawWidth: rawW,
      rawHeight: rawH,
      paperType,
      gsm,
      colour,
    });

    if (!paperGroups.has(normPaper.key)) {
      paperGroups.set(normPaper.key, {
        ...normPaper,
        groupNetSheets: 0,
        wastageSheets: 0,
        groupGrossSheets: 0,
        reams: 0,
        looseSheets: 0,
        groupCost: 0,
        looseRate,
        reamRate,
        plyCountInGroup: 0,
      });
    }
    const grp = paperGroups.get(normPaper.key);
    grp.groupNetSheets += netSheetsRequired;
    grp.plyCountInGroup += 1;

    resolvedPlies.push({
      plyIndex: i + 1,
      colour: normPaper.colour,
      paperType: normPaper.paperType,
      gsm: normPaper.gsm,
      rawWidth: normPaper.rawWidth,
      rawHeight: normPaper.rawHeight,
      rawSheetSize: normPaper.rawSheetSize,
      printRequired: rawConfig.printRequired !== false,
      printingMethod: printMethod,
      digitalSheetSize,
      inkColoursFront: rawConfig.inkColoursFront || ["Black"],
      inkColoursBack: rawConfig.inkColoursBack || [],
      cuttingYield: cutting.bestYield,
      layoutSelected: cutting.selectedLayout,
      cuttingGrid: cutting.grid,
      netSheetsRequired,
      wastageSheets: 0,
      grossSheetsToPurchase: netSheetsRequired,
      looseRate,
      reamRate,
      paperKey: normPaper.key,
      paperCost: 0,
    });
  }

  // 3. Apply wastage ONCE per normalized paper group, then compute Ream + Loose cost
  const paperGroupSummaries = [];
  paperGroups.forEach((grp) => {
    const wastageSheets = calculateGroupWastage(
      grp.groupNetSheets,
      effectiveWastageRules,
    );
    const groupGrossSheets = grp.groupNetSheets + wastageSheets;
    const costInfo = calculateReamAndLooseCost(
      groupGrossSheets,
      grp.reamRate,
      grp.looseRate,
    );

    grp.wastageSheets = wastageSheets;
    grp.groupGrossSheets = groupGrossSheets;
    grp.reams = costInfo.reams;
    grp.looseSheets = costInfo.looseSheets;
    grp.groupCost = costInfo.totalCost;

    totalPaperCost += costInfo.totalCost;
    paperGroupSummaries.push({ ...grp });
  });

  resolvedPlies.forEach((p) => {
    const grp = paperGroups.get(p.paperKey);
    if (!grp) return;
    p.wastageSheets =
      grp.plyCountInGroup === 1
        ? grp.wastageSheets
        : Number((grp.wastageSheets / grp.plyCountInGroup).toFixed(2));
    p.grossSheetsToPurchase =
      grp.plyCountInGroup === 1
        ? grp.groupGrossSheets
        : p.netSheetsRequired + p.wastageSheets;
    p.paperCost = Math.round(grp.groupCost / grp.plyCountInGroup);
  });

  // 2. Mini Offset Printing Calculations
  const offsetPlies = resolvedPlies.filter(
    (p) => p.printRequired !== false && p.printingMethod === "mini_offset",
  );
  let offsetDetails = null;
  if (offsetPlies.length > 0) {
    // Machine prints the cut finished sheets (e.g. 10 books * 100 pages = 1000 A4 impressions per ply)
    const cutImpressionsPerPly = qty * pages;
    offsetDetails = calculateMiniOffsetCost({
      plies: offsetPlies,
      impressionsPerPly: cutImpressionsPerPly,
      masterRate: effectiveMasterRate,
      runRate: effectiveRunRate,
    });
    totalMasterCost = offsetDetails.masterCost;
    totalOffsetRunCost = offsetDetails.runningCost;
  }

  // 3. Digital Printing Calculations
  const digitalPlies = resolvedPlies.filter(
    (p) => p.printRequired !== false && p.printingMethod === "digital",
  );
  let digitalDetails = null;
  if (digitalPlies.length > 0) {
    let sumDigitalCost = 0;
    const digitalBreakdown = [];
    digitalPlies.forEach((dply) => {
      const sheetW = dply.digitalSheetSize === "13x19" ? 19 : 18;
      const sheetH = dply.digitalSheetSize === "13x19" ? 13 : 12;
      const digYield = calculateCuttingYield({
        sheetWidth: sheetW,
        sheetHeight: sheetH,
        productWidth: finishedWidth,
        productHeight: finishedHeight,
      });
      if (digYield.bestYield <= 0) {
        throw new Error(
          `Finished dimensions (${finishedWidth}x${finishedHeight}) exceed digital sheet ${dply.digitalSheetSize}.`,
        );
      }
      const digSheets = Math.ceil((qty * pages) / digYield.bestYield);
      const isBoth = dply.inkColoursBack && dply.inkColoursBack.length > 0;
      const digCost = calculateDigitalCost({
        digitalSheetSize: dply.digitalSheetSize,
        isBothSides: isBoth,
        digitalSheetsCount: digSheets,
        paperColour: dply.colour,
        customRates: effectiveDigitalRates,
      });
      sumDigitalCost += digCost.digitalTotalCost;
      digitalBreakdown.push({ ply: dply.plyIndex, ...digCost });
    });
    totalDigitalCost = sumDigitalCost;
    digitalDetails = { totalCost: sumDigitalCost, plies: digitalBreakdown };
  }

  // 4. Binding & Finishing Calculations
  const finishing = calculateBindingAndFinishingCost({
    quantity: qty,
    bindingRatePerUnit: bindingRate,
    hasNumbering,
    numberingRatePerBook: effectiveNumberingRate,
    hasPunching,
    punchingRatePerBook: effectivePunchingRate,
  });

  // 5. Total Internal Vendor Production Cost
  const transportationCost = effectiveTransportCost;
  const totalVendorCost = Math.round(
    totalPaperCost +
      totalMasterCost +
      totalOffsetRunCost +
      totalDigitalCost +
      finishing.totalFinishingCost +
      transportationCost,
  );

  // 6. Recommended Selling Price based on target gross margin
  const recommendedSellingPrice = Math.round(
    totalVendorCost / (1 - marginPct / 100),
  );
  const finalSellingPrice =
    negotiatedSellingPrice !== null &&
    negotiatedSellingPrice !== "" &&
    !isNaN(Number(negotiatedSellingPrice))
      ? Math.max(0, Number(negotiatedSellingPrice))
      : recommendedSellingPrice;

  // Margin Evaluation
  const netMargin = Math.round(finalSellingPrice - totalVendorCost);
  const actualMarginPercent =
    finalSellingPrice > 0
      ? Number(((netMargin / finalSellingPrice) * 100).toFixed(1))
      : 0;

  // Taxes (GST default 0 as requested)
  const effectiveGstRate = Number(gstRate ?? 0);
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
      printRequired: p.printRequired,
      printing:
        p.printRequired === false
          ? "No Print (Blank)"
          : p.printingMethod === "digital"
            ? "Digital Print"
            : "Mini Offset Print",
      frontColours:
        p.printRequired === false ? "None" : p.inkColoursFront.join(", "),
      backColours:
        p.printRequired === false
          ? "None"
          : p.inkColoursBack.length > 0
            ? p.inkColoursBack.join(", ")
            : "None",
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
      paperGroups: paperGroupSummaries,
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
 * Evaluates candidate raw sheets and selects the sheet minimizing total order paper cost
 * (or cost per finished piece if totalPages is not provided), breaking ties by least waste.
 */
export function findOptimalRawSheet({
  finishedWidth,
  finishedHeight,
  totalPages = 1000,
  candidateSheets = [],
}) {
  const pW = Number(finishedWidth) || 4.5;
  const pH = Number(finishedHeight) || 11;
  const pages = Math.max(1, Number(totalPages) || 1000);
  const defaultSheets = [
    {
      rawWidthInch: 18,
      rawHeightInch: 22,
      looseSheetRate: 1.5,
      reamRate: 700,
      name: '18" × 22" (Standard Mini Offset Sheet)',
    },
    {
      rawWidthInch: 23,
      rawHeightInch: 36,
      looseSheetRate: 3.1,
      reamRate: 1400,
      name: '23" × 36" (Large Sheet)',
    },
    {
      rawWidthInch: 25,
      rawHeightInch: 36,
      looseSheetRate: 3.4,
      reamRate: 1550,
      name: '25" × 36" (Full Commercial Sheet)',
    },
  ];
  const sheets = candidateSheets.length > 0 ? candidateSheets : defaultSheets;

  let optimal = null;
  let minCost = Infinity;
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
    if (cut.bestYield <= 0) return;

    const req = calculatePaperRequirement({
      totalPages: pages,
      yieldPerSheet: cut.bestYield,
    });
    const looseRate = Number(s.looseSheetRate ?? 1.5);
    const reamRate = Number(s.reamRate ?? looseRate * 500 * 0.9);
    const fullReams = Math.floor(req.grossSheetsToPurchase / 500);
    const remLoose = req.grossSheetsToPurchase % 500;
    const totalCost = fullReams * reamRate + remLoose * looseRate;

    const sheetArea = sW * sH;
    const usedArea = cut.bestYield * pW * pH;
    const wasteRatio = sheetArea > 0 ? (sheetArea - usedArea) / sheetArea : 1;

    if (
      totalCost < minCost ||
      (Math.abs(totalCost - minCost) < 0.01 && wasteRatio < minWaste)
    ) {
      minCost = totalCost;
      minWaste = wasteRatio;
      optimal = {
        rawWidthInch: sW,
        rawHeightInch: sH,
        name: s.name || `${sW}" × ${sH}"`,
        bestYield: cut.bestYield,
        selectedLayout: cut.selectedLayout,
        grid: cut.grid,
        estimatedPaperCost: Math.round(totalCost),
        grossSheets: req.grossSheetsToPurchase,
        wastePercent: Math.round(wasteRatio * 1000) / 10,
      };
    }
  });

  return (
    optimal || {
      rawWidthInch: 0,
      rawHeightInch: 0,
      name: "No fitting raw sheet",
      bestYield: 0,
      selectedLayout: "none",
      grid: { cols: 0, rows: 0 },
      estimatedPaperCost: 0,
      grossSheets: 0,
      wastePercent: 100,
    }
  );
}

/**
 * 8b. Least-Wastage Raw Sheet Selector (Height & Width Cutting Optimizer)
 * Evaluates all unique raw sheet sizes from the database (PaperMaster) and picks
 * the sheet with the lowest cutting wastage % (breaking ties by lowest cost, then highest yield).
 */
export function selectLeastWastageRawSheet({
  finishedWidth,
  finishedHeight,
  totalPages = 1000,
  candidateSheets = [],
}) {
  const pW = Number(finishedWidth) || 4.5;
  const pH = Number(finishedHeight) || 11;
  const pages = Math.max(1, Number(totalPages) || 1000);

  const defaultSheets = [
    { rawWidthInch: 18, rawHeightInch: 22, looseSheetRate: 1.5, reamRate: 700, name: '18" × 22"' },
    { rawWidthInch: 23, rawHeightInch: 36, looseSheetRate: 3.1, reamRate: 1400, name: '23" × 36"' },
    { rawWidthInch: 25, rawHeightInch: 36, looseSheetRate: 3.4, reamRate: 1550, name: '25" × 36"' },
  ];
  const rawCandidates = candidateSheets.length > 0 ? candidateSheets : defaultSheets;

  // Deduplicate candidate raw sheet sizes while keeping best/lowest rate per size
  const uniqueSizes = new Map();
  rawCandidates.forEach((s) => {
    const sW = Number(s.rawWidthInch || s.rawSheetWidth || s.width || 0);
    const sH = Number(s.rawHeightInch || s.rawSheetHeight || s.height || 0);
    if (!Number.isFinite(sW) || !Number.isFinite(sH) || sW <= 0 || sH <= 0) return;
    const key = `${Math.min(sW, sH)}x${Math.max(sW, sH)}`;
    if (!uniqueSizes.has(key)) {
      uniqueSizes.set(key, {
        rawWidthInch: sW,
        rawHeightInch: sH,
        looseSheetRate: Number(s.looseSheetRate ?? s.currentRate?.looseRatePerSheet ?? 1.5),
        reamRate: Number(s.reamRate ?? s.currentRate?.reamRate ?? 700),
        name: s.name || `${sW}" × ${sH}"`,
      });
    }
  });

  let best = null;
  let minWaste = Infinity;
  let minCost = Infinity;
  let maxYield = -1;

  uniqueSizes.forEach((s) => {
    const cut = calculateCuttingYield({
      sheetWidth: s.rawWidthInch,
      sheetHeight: s.rawHeightInch,
      productWidth: pW,
      productHeight: pH,
    });
    if (cut.bestYield <= 0) return;

    const req = calculatePaperRequirement({
      totalPages: pages,
      yieldPerSheet: cut.bestYield,
    });
    const costInfo = calculateReamAndLooseCost(
      req.grossSheetsToPurchase,
      s.reamRate,
      s.looseSheetRate,
    );

    const sheetArea = s.rawWidthInch * s.rawHeightInch;
    const usedArea = cut.bestYield * pW * pH;
    const wasteRatio =
      sheetArea > 0 ? Math.max(0, (sheetArea - usedArea) / sheetArea) : 1;

    const isLowerWaste = wasteRatio < minWaste - 0.001;
    const isSameWaste = Math.abs(wasteRatio - minWaste) <= 0.001;
    const isBetterTie =
      isSameWaste &&
      (costInfo.totalCost < minCost ||
        (costInfo.totalCost === minCost && cut.bestYield > maxYield));

    if (isLowerWaste || isBetterTie) {
      minWaste = wasteRatio;
      minCost = costInfo.totalCost;
      maxYield = cut.bestYield;
      best = {
        rawWidthInch: s.rawWidthInch,
        rawHeightInch: s.rawHeightInch,
        name: s.name,
        bestYield: cut.bestYield,
        selectedLayout: cut.selectedLayout,
        grid: cut.grid,
        wastePercent: Math.round(wasteRatio * 1000) / 10,
        efficiencyPercent: Math.round((1 - wasteRatio) * 1000) / 10,
        estimatedPaperCost: costInfo.totalCost,
        grossSheets: req.grossSheetsToPurchase,
      };
    }
  });

  return (
    best || {
      rawWidthInch: 0,
      rawHeightInch: 0,
      name: "No fitting raw sheet",
      bestYield: 0,
      selectedLayout: "none",
      grid: { cols: 0, rows: 0 },
      wastePercent: 100,
      efficiencyPercent: 0,
      estimatedPaperCost: 0,
      grossSheets: 0,
    }
  );
}

/**
 * 9. Company-Level Consolidated Paper Purchase Aggregator
 * Filters eligible confirmed/approved orders, sums NET sheets per normalized paper group,
 * applies wastage ONCE per consolidated group, and computes Ream + Loose purchase costs
 * without mutating individual orders or customer quotations.
 */
export function consolidatePaperPurchases(
  orders = [],
  { wastageRules = { loose: 5, ream: 10 } } = {},
) {
  const groups = new Map();
  const seenRefs = new Set();
  let individualPaperCostTotal = 0;

  orders.forEach((order) => {
    if (!order) return;
    // Strict status check: only approved/confirmed/active production orders are eligible
    const statusNorm = order.status ? String(order.status).toLowerCase() : "";
    if (!ELIGIBLE_CONSOLIDATION_STATUSES.has(statusNorm)) {
      return;
    }

    // Prevent duplicate counting when a Quotation (job_created) and its JobCard share quoteRef
    const dedupeKey = order.quoteRef
      ? `quote:${String(order.quoteRef).trim()}`
      : order.jobId
        ? `job:${String(order.jobId).trim()}`
        : order._id
          ? `id:${String(order._id)}`
          : null;
    if (dedupeKey) {
      if (seenRefs.has(dedupeKey)) return;
      seenRefs.add(dedupeKey);
    }

    const orderGroups = order?.productionTechnicalDetails?.paperGroups;
    if (Array.isArray(orderGroups) && orderGroups.length > 0) {
      orderGroups.forEach((og) => {
        individualPaperCostTotal += Number(og.groupCost || 0);
      });
    }

    const plies =
      order?.productionTechnicalDetails?.resolvedPlies ||
      order?.plyConfigurations ||
      [];

    plies.forEach((ply) => {
      const net = Math.max(
        0,
        Number(ply.netSheetsRequired ?? ply.netSheets ?? ply.sheetsRequired ?? 0),
      );
      if (net <= 0) return;

      const norm = buildNormalizedPaperKey({
        rawWidth: ply.rawWidth,
        rawHeight: ply.rawHeight,
        rawSheetSize: ply.rawSheetSize,
        paperType: ply.paperType,
        gsm: ply.gsm,
        colour: ply.colour,
      });

      const looseRate = Number(ply.looseRate ?? ply.looseSheetRate ?? 1.5);
      const reamRate = Number(ply.reamRate ?? 700);

      if (!Array.isArray(orderGroups) || orderGroups.length === 0) {
        const indivGross =
          net + calculateGroupWastage(net, wastageRules);
        const indivCost = calculateReamAndLooseCost(
          indivGross,
          reamRate,
          looseRate,
        );
        individualPaperCostTotal += indivCost.totalCost;
      }

      if (!groups.has(norm.key)) {
        groups.set(norm.key, {
          ...norm,
          consolidatedNet: 0,
          wastageSheets: 0,
          consolidatedGross: 0,
          totalGrossSheets: 0,
          looseRate,
          reamRate,
        });
      }
      groups.get(norm.key).consolidatedNet += net;
    });
  });

  let consolidatedPaperCostTotal = 0;
  const items = [];
  groups.forEach((g) => {
    const wastageSheets = calculateGroupWastage(
      g.consolidatedNet,
      wastageRules,
    );
    const consolidatedGross = g.consolidatedNet + wastageSheets;
    const costInfo = calculateReamAndLooseCost(
      consolidatedGross,
      g.reamRate,
      g.looseRate,
    );

    consolidatedPaperCostTotal += costInfo.totalCost;
    items.push({
      ...g,
      wastageSheets,
      consolidatedGross,
      totalGrossSheets: consolidatedGross,
      reams: costInfo.reams,
      looseSheets: costInfo.looseSheets,
      reamCost: costInfo.reamCost,
      looseCost: costInfo.looseCost,
      consolidatedCost: costInfo.totalCost,
    });
  });

  return {
    items,
    individualPaperCostTotal: Math.round(individualPaperCostTotal),
    consolidatedPaperCostTotal: Math.round(consolidatedPaperCostTotal),
    procurementSavings: Math.round(
      individualPaperCostTotal - consolidatedPaperCostTotal,
    ),
  };
}
