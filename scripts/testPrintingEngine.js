import {
  calculateCuttingYield,
  calculatePaperRequirement,
  calculateMiniOffsetCost,
  calculateDigitalCost,
  calculateBindingAndFinishingCost,
  calculateCommercialPrintOrder,
  findOptimalRawSheet,
  consolidatePaperPurchases,
  calculateGroupWastage,
  calculateReamAndLooseCost,
  selectLeastWastageRawSheet,
} from "../services/printingCalcEngine.js";
import {
  calculateSalesBillBookQuote,
  selectLeastWastageSheetFromDb,
} from "../../frontend/src/utils/salesBillBookEngine.js";

console.log("=================================================");
console.log("🧪 RUNNING A2V PRINTS CALCULATION ENGINE TEST SUITE");
console.log("=================================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

// -------------------------------------------------------------
// TEST 1: Cutting Yield Engine (Handover Document Part 5.1 & 5.2)
// Raw Sheet: 18 x 22 inch, Product: 4.5 x 11 inch
// Vertical: (18 / 4.5 = 4) * (22 / 11 = 2) = 8
// Horizontal: (18 / 11 = 1) * (22 / 4.5 = 4) = 4
// Expected Best Yield = 8 pieces, Selected = "vertical"
// -------------------------------------------------------------
const yieldTest1 = calculateCuttingYield({
  sheetWidth: 18,
  sheetHeight: 22,
  productWidth: 4.5,
  productHeight: 11,
});

assert(yieldTest1.verticalYield === 8, "Vertical yield for 4.5x11 on 18x22 must be 8");
assert(yieldTest1.horizontalYield === 4, "Horizontal yield for 4.5x11 on 18x22 must be 4");
assert(yieldTest1.bestYield === 8, "Best yield must be 8 pieces");
assert(yieldTest1.selectedLayout === "vertical", "Selected layout must be 'vertical'");

// Tie breaker test: Both yield equal -> Default vertical
const tieTest = calculateCuttingYield({
  sheetWidth: 20,
  sheetHeight: 20,
  productWidth: 5,
  productHeight: 5,
});
assert(tieTest.selectedLayout === "vertical", "On yield tie, default layout must be 'vertical'");

// A4 yield test on 18x22 -> must be 4 pieces (8.27" x 11.69")
const a4Test = calculateCuttingYield({
  sheetWidth: 18,
  sheetHeight: 22,
  productWidth: 8.27,
  productHeight: 11.69,
});
assert(a4Test.bestYield === 4, "A4 (8.27x11.69) on 18x22 must yield 4 pieces");

// A5 (half A4) yield test on 18x22 -> must be 8 pieces (5.83" x 8.27")
const a5Test = calculateCuttingYield({
  sheetWidth: 18,
  sheetHeight: 22,
  productWidth: 5.83,
  productHeight: 8.27,
});
assert(a5Test.bestYield === 8, "A5 (5.83x8.27) on 18x22 must yield 8 pieces");

// Combination cutting test (Image 1 reference: 8.5" x 14" on 23" x 36")
// Pure vertical = 4, Pure horizontal = 4.
// Combination cutting (4 vertical + 2 horizontal) = 6 pieces!
const comboTest = calculateCuttingYield({
  sheetWidth: 23,
  sheetHeight: 36,
  productWidth: 8.5,
  productHeight: 14,
});
assert(comboTest.bestYield === 6, "8.5x14 on 23x36 must yield 6 pieces via combination cutting (Image 1 reference)");
assert(comboTest.selectedLayout === "combination", "Combination cut layout must be identified as 'combination'");

// -------------------------------------------------------------
// TEST 2: Paper Requirement & Wastage Engine (Part 5.4)
// Example from Doc:
// 10 Pads × 100 Pages = 1,000 Pages.
// 1,000 ÷ 8 = 125 Sheets.
// Loose Purchase Wastage = 5 Sheets.
// Final Requirement = 130 Sheets.
// -------------------------------------------------------------
const paperTest = calculatePaperRequirement({
  totalPages: 1000,
  yieldPerSheet: 8,
  purchaseMode: "loose",
  wastageRules: { loose: 5, ream: 10 },
});

assert(paperTest.netSheetsRequired === 125, "Net sheets required must be 125");
assert(paperTest.wastageSheets === 5, "Loose purchase wastage must be +5 sheets");
assert(paperTest.grossSheetsToPurchase === 130, "Gross purchase sheets must be 130");

// -------------------------------------------------------------
// TEST 3: Mini Offset Master & Machine Run Slabs (Part 7.4)
// White Paper Black Front (1 Run) + Yellow Paper Black Front (1 Run) = 2 Runs = ₹140
// -------------------------------------------------------------
const offsetTest1 = calculateMiniOffsetCost({
  plies: [
    { colour: "White", inkColoursFront: ["Black"] },
    { colour: "Yellow", inkColoursFront: ["Black"] },
  ],
  impressionsPerPly: 500, // < 1,000 impressions = 1 slab
  masterRate: 30,
  runRate: 70,
});

assert(offsetTest1.masterCount === 1, "White & Yellow with same Black design must share 1 Master");
assert(offsetTest1.masterCost === 30, "1 Master cost must be ₹30");
assert(offsetTest1.totalRuns === 2, "White + Yellow Black Front must be 2 runs");
assert(offsetTest1.runningCost === 140, "2 runs @ ₹70 must be ₹140");
assert(offsetTest1.offsetTotalCost === 170, "Total offset cost must be ₹170 (₹30 master + ₹140 run)");

// Multi-color test (Part 7.4): White Black, Yellow Black, White Red, Yellow Red = 4 runs = ₹280, 2 masters = ₹60
const offsetTest2 = calculateMiniOffsetCost({
  plies: [
    { colour: "White", inkColoursFront: ["Black", "Red"] },
    { colour: "Yellow", inkColoursFront: ["Black", "Red"] },
  ],
  impressionsPerPly: 800,
  masterRate: 30,
  runRate: 70,
});

assert(offsetTest2.masterCount === 2, "Black + Red must require 2 masters");
assert(offsetTest2.masterCost === 60, "2 masters cost must be ₹60");
assert(offsetTest2.totalRuns === 4, "4 color runs total");
assert(offsetTest2.runningCost === 280, "4 runs @ ₹70 must be ₹280");

// -------------------------------------------------------------
// TEST 4: Digital Printing Engine (Part 8)
// 12x18: Front ₹6, Both ₹7
// 13x19: Front ₹7, Both ₹9
// Restricted to White paper
// -------------------------------------------------------------
const digital1218Front = calculateDigitalCost({
  digitalSheetSize: "12x18",
  isBothSides: false,
  digitalSheetsCount: 100,
  paperColour: "White",
});
assert(digital1218Front.ratePerSheet === 6, "Digital 12x18 Front rate must be ₹6");
assert(digital1218Front.digitalTotalCost === 600, "100 sheets @ ₹6 = ₹600");

const digital1319Both = calculateDigitalCost({
  digitalSheetSize: "13x19",
  isBothSides: true,
  digitalSheetsCount: 50,
  paperColour: "White",
});
assert(digital1319Both.ratePerSheet === 9, "Digital 13x19 Both sides rate must be ₹9");
assert(digital1319Both.digitalTotalCost === 450, "50 sheets @ ₹9 = ₹450");

// Verify prohibition on Yellow/Pink
let threwYellowError = false;
try {
  calculateDigitalCost({
    digitalSheetSize: "12x18",
    digitalSheetsCount: 10,
    paperColour: "Yellow",
  });
} catch (e) {
  threwYellowError = true;
}
assert(threwYellowError, "Digital printing on Yellow paper must be strictly prohibited");

// -------------------------------------------------------------
// TEST 5: Binding & Finishing Engine (Parts 9 & 10)
// 10 books @ ₹25 A4 normal binding + ₹2 numbering + ₹2 punching
// -------------------------------------------------------------
const finishTest = calculateBindingAndFinishingCost({
  quantity: 10,
  bindingRatePerUnit: 25,
  hasNumbering: true,
  numberingRatePerBook: 2,
  hasPunching: true,
  punchingRatePerBook: 2,
});

assert(finishTest.bindingCost === 250, "10 books @ ₹25 binding = ₹250");
assert(finishTest.numberingCost === 20, "10 books @ ₹2 numbering = ₹20");
assert(finishTest.punchingCost === 20, "10 books @ ₹2 punching = ₹20");
assert(finishTest.totalFinishingCost === 290, "Total finishing = ₹290");

// -------------------------------------------------------------
// TEST 6: Complete Commercial Order Dual View (Sales vs Manager/Admin)
// -------------------------------------------------------------
const completeOrder = calculateCommercialPrintOrder({
  productName: "Bill Book",
  quantity: 10,
  pagesPerBook: 100,
  finishedWidth: 4.5,
  finishedHeight: 11,
  plyCount: 2, // 2-Ply (White + Yellow)
  plyConfigurations: [
    { colour: "White", gsm: 64, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.3 },
    { colour: "Yellow", gsm: 58, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.1 },
  ],
  bindingType: "Normal Binding",
  bindingRate: 25,
  hasNumbering: true,
  numberingStart: 1,
  hasPunching: true,
  negotiatedSellingPrice: 1800,
  gstRate: 0,
});

// Verify Sales View contains NO sensitive internal cost or margin
assert(completeOrder.salesExecutiveView.pricing.subtotal === 1800, "Sales view has correct selling price");
assert(completeOrder.salesExecutiveView.productionTechnicalDetails === undefined, "Sales view must NOT contain production details");
assert(completeOrder.salesExecutiveView.internalCostBreakdown === undefined, "Sales view must NOT contain internal cost breakdown");
assert(completeOrder.salesExecutiveView.commercialFinancials === undefined, "Sales view must NOT contain margin or profit");

// Verify Manager/Admin View contains full breakdown
assert(completeOrder.managerProductionView.internalCostBreakdown.totalVendorProductionCost > 0, "Manager view contains total vendor cost");
assert(completeOrder.managerProductionView.commercialFinancials.netProfitMargin !== undefined, "Manager view contains net profit margin");
assert(completeOrder.managerProductionView.commercialFinancials.profitMarginPercent !== undefined, "Manager view contains margin %");

// -------------------------------------------------------------
// TEST 7: Regression Tests for Gap Analysis Fixes
// -------------------------------------------------------------
const nonA5Test = calculateCuttingYield({ sheetWidth: 18, sheetHeight: 22, productWidth: 6.0, productHeight: 9.5 });
assert(nonA5Test.bestYield === 6 && nonA5Test.efficiency <= 100, "6.0x9.5 on 18x22 must yield 6 (not false A5 8-out)");

const zeroWastageTest = calculatePaperRequirement({ totalPages: 1000, yieldPerSheet: 8, wastageRules: { loose: 0, ream: 0 } });
assert(zeroWastageTest.wastageSheets === 0 && zeroWastageTest.grossSheetsToPurchase === 125, "0 wastage rule must be respected");

const zeroPagesTest = calculatePaperRequirement({ totalPages: 0, yieldPerSheet: 8 });
assert(zeroPagesTest.grossSheetsToPurchase === 0, "0 pages must require 0 gross sheets");

const zeroOffsetTest = calculateMiniOffsetCost({ plies: [{ printingMethod: "digital" }], impressionsPerPly: 500 });
assert(zeroOffsetTest.masterCount === 0 && zeroOffsetTest.offsetTotalCost === 0, "All-digital plies must charge ₹0 offset cost");

let threwEmptyColor = false;
try {
  calculateDigitalCost({ digitalSheetSize: "12x18", digitalSheetsCount: 10, paperColour: "" });
} catch {
  threwEmptyColor = true;
}
assert(threwEmptyColor, "Digital printing with empty paperColour must throw");

let threwBadDigitalSize = false;
try {
  calculateDigitalCost({ digitalSheetSize: "A4", digitalSheetsCount: 10, paperColour: "White" });
} catch {
  threwBadDigitalSize = true;
}
assert(threwBadDigitalSize, "Digital printing with unsupported sheet size must throw");

const optSheet = findOptimalRawSheet({ finishedWidth: 4.5, finishedHeight: 11, totalPages: 1000 });
assert(optSheet.rawWidthInch === 18 && optSheet.rawHeightInch === 22, "4.5x11 optimal cost sheet must be 18x22");

const smallOrder = calculateCommercialPrintOrder({
  quantity: 5,
  pagesPerBook: 100,
  finishedWidth: 4.5,
  finishedHeight: 11,
  plyCount: 1,
  plyConfigurations: [{ colour: "White", gsm: 64, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.3, reamRate: 650 }],
});
assert(smallOrder.managerProductionView.productionTechnicalDetails.resolvedPlies[0].wastageSheets === 5, "500 pages (63 raw sheets) must use +5 loose wastage, not +10 ream");

const consolidated = consolidatePaperPurchases([
  { status: "approved", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 300, looseSheetRate: 1.5, reamRate: 700 }] },
  { status: "job_created", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 300, looseSheetRate: 1.5, reamRate: 700 }] },
]);
assert(
  consolidated.items[0].consolidatedNet === 600 &&
    consolidated.items[0].wastageSheets === 10 &&
    consolidated.items[0].consolidatedGross === 610 &&
    consolidated.items[0].reams === 1 &&
    consolidated.items[0].looseSheets === 110,
  "Consolidating 300+300 net sheets must yield 600 net + 10 wastage = 610 gross (1 ream + 110 loose)"
);

// -------------------------------------------------------------
// TEST 8: Approved Wastage Rule — Thresholds, Multi-Ply, Consolidation, Integrity & Parity
// -------------------------------------------------------------
// A. Threshold tests
assert(calculateGroupWastage(0) === 0, "Threshold: 0 net sheets -> 0 wastage");
assert(calculateGroupWastage(1) === 5, "Threshold: 1 net sheet -> 5 wastage");
assert(calculateGroupWastage(499) === 5, "Threshold: 499 net sheets -> 5 wastage");
assert(calculateGroupWastage(500) === 10, "Threshold: 500 net sheets -> 10 wastage");
assert(calculateGroupWastage(501) === 10, "Threshold: 501 net sheets -> 10 wastage");
assert(calculateGroupWastage(1000) === 10, "Threshold: 1,000 net sheets -> 10 wastage");
assert(calculateGroupWastage(2000) === 10, "Threshold: 2,000 net sheets -> 10 wastage");

const emptyOrderReq = calculatePaperRequirement({ totalPages: 0, yieldPerSheet: 8 });
assert(emptyOrderReq.wastageSheets === 0 && emptyOrderReq.grossSheetsToPurchase === 0, "Empty requirement: 0 wastage and 0 gross");

// B. Same-paper multi-ply tests
// B1: 250 + 250 same specs -> 500 net + 10 wastage = 510 gross
const samePaper500 = calculateCommercialPrintOrder({
  quantity: 20,
  pagesPerBook: 100,
  finishedWidth: 4.5,
  finishedHeight: 11,
  plyCount: 2,
  plyConfigurations: [
    { colour: "White", paperType: "Maplitho", gsm: 70, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700 },
    { colour: "White", paperType: "Maplitho", gsm: 70, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700 },
  ],
});
const sp500Grp = samePaper500.managerProductionView.productionTechnicalDetails.paperGroups[0];
assert(
  sp500Grp.groupNetSheets === 500 &&
    sp500Grp.wastageSheets === 10 &&
    sp500Grp.groupGrossSheets === 510 &&
    sp500Grp.reams === 1 &&
    sp500Grp.looseSheets === 10 &&
    sp500Grp.groupCost === 715,
  "2-ply same paper (250+250) -> 500 net + 10 wastage = 510 gross (1 ream + 10 loose = ₹715)"
);

// B2: 200 + 200 same specs -> 400 net + 5 wastage = 405 gross
const samePaper400 = calculateCommercialPrintOrder({
  quantity: 16,
  pagesPerBook: 100,
  finishedWidth: 4.5,
  finishedHeight: 11,
  plyCount: 2,
  plyConfigurations: [
    { colour: "White", paperType: "Maplitho", gsm: 70, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700 },
    { colour: "White", paperType: "Maplitho", gsm: 70, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700 },
  ],
});
const sp400Grp = samePaper400.managerProductionView.productionTechnicalDetails.paperGroups[0];
assert(
  sp400Grp.groupNetSheets === 400 && sp400Grp.wastageSheets === 5 && sp400Grp.groupGrossSheets === 405,
  "2-ply same paper (200+200) -> 400 net + 5 wastage = 405 gross"
);

// B3: 250 White + 250 Yellow, same GSM -> two separate groups, each +5
const diffColour250 = calculateCommercialPrintOrder({
  quantity: 20,
  pagesPerBook: 100,
  finishedWidth: 4.5,
  finishedHeight: 11,
  plyCount: 2,
  plyConfigurations: [
    { colour: "White", paperType: "Maplitho", gsm: 70, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700 },
    { colour: "Yellow", paperType: "Maplitho", gsm: 70, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.6, reamRate: 750 },
  ],
});
assert(
  diffColour250.managerProductionView.productionTechnicalDetails.paperGroups.length === 2 &&
    diffColour250.managerProductionView.productionTechnicalDetails.paperGroups.every((g) => g.wastageSheets === 5 && g.groupGrossSheets === 255),
  "250 White + 250 Yellow same GSM -> two separate groups, each +5 wastage (255 gross)"
);

// B4: 250 64 GSM + 250 70 GSM -> two separate groups
const diffGsm250 = calculateCommercialPrintOrder({
  quantity: 20,
  pagesPerBook: 100,
  finishedWidth: 4.5,
  finishedHeight: 11,
  plyCount: 2,
  plyConfigurations: [
    { colour: "White", paperType: "Maplitho", gsm: 64, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.4, reamRate: 650 },
    { colour: "White", paperType: "Maplitho", gsm: 70, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700 },
  ],
});
assert(
  diffGsm250.managerProductionView.productionTechnicalDetails.paperGroups.length === 2 &&
    diffGsm250.managerProductionView.productionTechnicalDetails.paperGroups.every((g) => g.wastageSheets === 5),
  "250 (64 GSM) + 250 (70 GSM) -> two separate groups, each +5 wastage"
);

// C. Consolidation tests
const makeOrder125 = (status) => {
  const res = calculateCommercialPrintOrder({
    quantity: 10,
    pagesPerBook: 100,
    finishedWidth: 4.5,
    finishedHeight: 11,
    plyCount: 1,
    plyConfigurations: [
      { colour: "White", paperType: "Maplitho", gsm: 70, rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700 },
    ],
  });
  return { ...res, status };
};

const fourOrders = [
  makeOrder125("confirmed"),
  makeOrder125("approved"),
  makeOrder125("job_created"),
  makeOrder125("confirmed"),
];
const snapshotsBefore = fourOrders.map((o) => ({
  pricing: JSON.stringify(o.salesExecutiveView.pricing),
  paperCost: o.managerProductionView.internalCostBreakdown.paperCostTotal,
  rawOrder: JSON.stringify(o.managerProductionView),
}));

const consol4 = consolidatePaperPurchases(
  fourOrders.map((o) => ({ ...o.managerProductionView, status: o.status }))
);
assert(
  consol4.items.length === 1 &&
    consol4.items[0].consolidatedNet === 500 &&
    consol4.items[0].wastageSheets === 10 &&
    consol4.items[0].consolidatedGross === 510 &&
    consol4.items[0].reams === 1 &&
    consol4.items[0].looseSheets === 10 &&
    consol4.consolidatedPaperCostTotal === 715 &&
    consol4.individualPaperCostTotal === 780 &&
    consol4.procurementSavings === 65,
  "4 confirmed orders of 125 net -> consolidated 500 net + 10 wastage = 510 gross (₹715, ₹65 savings)"
);

// C2: 3 confirmed orders of 100 net each -> 300 net + 5 = 305 gross
const consol3 = consolidatePaperPurchases([
  { status: "confirmed", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 100, looseSheetRate: 1.5, reamRate: 700 }] },
  { status: "approved", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 100, looseSheetRate: 1.5, reamRate: 700 }] },
  { status: "job_created", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 100, looseSheetRate: 1.5, reamRate: 700 }] },
]);
assert(
  consol3.items[0].consolidatedNet === 300 &&
    consol3.items[0].wastageSheets === 5 &&
    consol3.items[0].consolidatedGross === 305,
  "3 confirmed orders of 100 net -> consolidated 300 net + 5 wastage = 305 gross"
);

// C3: Draft, sent_to_client, negotiating, cancelled, rejected, dispatched, and missing status excluded
const consolFiltered = consolidatePaperPurchases([
  { status: "confirmed", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 100 }] },
  { status: "draft", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 500 }] },
  { status: "sent_to_client", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 500 }] },
  { status: "negotiating", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 500 }] },
  { status: "cancelled", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 500 }] },
  { status: "rejected", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 500 }] },
  { status: "dispatched", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 500 }] },
  { plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 500 }] },
]);
assert(
  consolFiltered.items.length === 1 && consolFiltered.items[0].consolidatedNet === 100,
  "Draft, sent_to_client, negotiating, cancelled, rejected, dispatched, and missing-status orders must be excluded"
);

// C3b: Prevent duplicate counting when Quotation (job_created) and JobCard share quoteRef
const consolDedupe = consolidatePaperPurchases([
  { quoteRef: "Q-A2V-2026-0001", status: "job_created", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 250 }] },
  { jobId: "JOB-2026-0001", quoteRef: "Q-A2V-2026-0001", status: "created", plyConfigurations: [{ rawWidth: 18, rawHeight: 22, paperType: "Maplitho", gsm: 70, colour: "White", netSheetsRequired: 250 }] },
]);
assert(
  consolDedupe.items[0].consolidatedNet === 250 && consolDedupe.items[0].wastageSheets === 5 && consolDedupe.items[0].consolidatedGross === 255,
  "Quotation and JobCard sharing the same quoteRef must not be double-counted"
);

// C4 & C5: Equivalent size format grouping & separation of different specs
const consolNorm = consolidatePaperPurchases([
  { status: "confirmed", plyConfigurations: [{ rawSheetSize: "18x22", paperType: "  maplitho ", gsm: 70, colour: "white", netSheetsRequired: 200 }] },
  { status: "confirmed", plyConfigurations: [{ rawSheetSize: "18 × 22 inch", paperType: "Maplitho", gsm: 70, colour: "WHITE", netSheetsRequired: 300 }] },
  { status: "confirmed", plyConfigurations: [{ rawSheetSize: "18x22", paperType: "Maplitho", gsm: 64, colour: "White", netSheetsRequired: 100 }] },
  { status: "confirmed", plyConfigurations: [{ rawSheetSize: "18x22", paperType: "Maplitho", gsm: 70, colour: "Yellow", netSheetsRequired: 100 }] },
]);
assert(
  consolNorm.items.length === 3 &&
    consolNorm.items.find((i) => i.gsm === 70 && i.colour.toLowerCase() === "white")?.consolidatedNet === 500,
  "Equivalent size/case/whitespace specs group together; different GSM/colour stay separate"
);

// D. Data integrity tests: original orders unmutated & customer quotes unchanged
fourOrders.forEach((o, idx) => {
  assert(
    JSON.stringify(o.salesExecutiveView.pricing) === snapshotsBefore[idx].pricing &&
      o.managerProductionView.internalCostBreakdown.paperCostTotal === snapshotsBefore[idx].paperCost &&
      JSON.stringify(o.managerProductionView) === snapshotsBefore[idx].rawOrder,
    `Data integrity: Order ${idx + 1} quote, paper cost, and snapshot remain unmutated after consolidation`
  );
});

// E. Frontend / Backend parity test (SalesBillBookEngine vs PrintingCalcEngine)
const parityMasterPapers = [
  { rawWidthInch: 18, rawHeightInch: 22, paperType: "Maplitho", gsm: 70, colour: "White", looseSheetRate: 1.5, reamRate: 700 },
];
const sbbParity = calculateSalesBillBookQuote(
  {
    sizeId: "a5",
    quantity: 20,
    setsPerBook: 100,
    plies: [
      { paperType: "Maplitho", gsm: 70, colour: "White" },
      { paperType: "Maplitho", gsm: 70, colour: "White" },
    ],
    printProcess: "single_color_offset",
    bindingType: "normal",
    numbering: false,
    salesMarginPercent: 25,
  },
  { papers: parityMasterPapers }
);
const backendParity = calculateCommercialPrintOrder({
  quantity: 20,
  pagesPerBook: 100,
  finishedWidth: 5.83,
  finishedHeight: 8.27,
  plyCount: 2,
  plyConfigurations: [
    { paperType: "Maplitho", gsm: 70, colour: "White", rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700 },
    { paperType: "Maplitho", gsm: 70, colour: "White", rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700 },
  ],
  bindingType: "Normal Binding",
  bindingRate: 25,
  hasNumbering: false,
  targetMarginPercent: 25,
});
assert(
  sbbParity.totalRawSheetsOrder === 510 &&
    sbbParity.wastageSheetsTotal === 10 &&
    sbbParity.totalPaperCost === backendParity.managerProductionView.internalCostBreakdown.paperCostTotal,
  "Frontend SalesBillBookEngine and Backend PrintingCalcEngine must agree on 2-ply same-paper wastage (510 gross, ₹715)"
);

// F. Per-Ply Print Required / Blank Sheet tests
const mixedPrintRequired = calculateCommercialPrintOrder({
  quantity: 10,
  pagesPerBook: 100,
  finishedWidth: 4.5,
  finishedHeight: 11,
  plyCount: 2,
  plyConfigurations: [
    { paperType: "Maplitho", gsm: 70, colour: "White", rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700, printRequired: true },
    { paperType: "Maplitho", gsm: 70, colour: "Yellow", rawWidth: 18, rawHeight: 22, looseSheetRate: 1.6, reamRate: 750, printRequired: false },
  ],
  bindingType: "Normal Binding",
  bindingRate: 25,
});
assert(
  mixedPrintRequired.managerProductionView.internalCostBreakdown.masterCostTotal === 30 &&
    mixedPrintRequired.managerProductionView.internalCostBreakdown.offsetRunCostTotal === 70 &&
    mixedPrintRequired.salesExecutiveView.plySummary[1].printing === "No Print (Blank)",
  "2-ply with Ply 2 printRequired=false must charge 1 run (₹70) instead of 2 runs (₹140)"
);

const allBlankOrder = calculateCommercialPrintOrder({
  quantity: 10,
  pagesPerBook: 100,
  finishedWidth: 4.5,
  finishedHeight: 11,
  plyCount: 1,
  plyConfigurations: [
    { paperType: "Maplitho", gsm: 70, colour: "White", rawWidth: 18, rawHeight: 22, looseSheetRate: 1.5, reamRate: 700, printRequired: false },
  ],
});
assert(
  allBlankOrder.managerProductionView.internalCostBreakdown.masterCostTotal === 0 &&
    allBlankOrder.managerProductionView.internalCostBreakdown.offsetRunCostTotal === 0 &&
    allBlankOrder.managerProductionView.internalCostBreakdown.digitalCostTotal === 0 &&
    allBlankOrder.managerProductionView.internalCostBreakdown.paperCostTotal === 195,
  "All-blank order (printRequired=false) must charge ₹0 printing while keeping paper cost (₹195)"
);

const sbbMixedPrint = calculateSalesBillBookQuote(
  {
    sizeId: "a5",
    quantity: 10,
    setsPerBook: 100,
    plies: [
      { paperType: "Maplitho", gsm: 70, colour: "White", printRequired: true },
      { paperType: "Maplitho", gsm: 70, colour: "Yellow", printRequired: false },
    ],
    printProcess: "single_color_offset",
    bindingType: "normal",
    numbering: false,
  },
  { papers: parityMasterPapers }
);
assert(
  sbbMixedPrint.totalImpressions === 1000 && sbbMixedPrint.printingCost === 100,
  "SalesBillBookEngine with Ply 2 printRequired=false must charge 1,000 impressions (₹30 + ₹70 = ₹100)"
);

// G. Exact Parity for A4 10 Books x 100 Sets 1-Ply Newspaper/Newsprint 49 GSM (Vendor Raw Price = ₹604)
const sbbVendorRaw = calculateSalesBillBookQuote(
  {
    sizeId: "a4",
    quantity: 10,
    setsPerBook: 100,
    plies: [{ paperType: "Newsprint", gsm: 49, colour: "White" }],
    printProcess: "single_color_offset",
    bindingType: "normal",
    numbering: false,
  },
  {
    papers: [
      { rawWidthInch: 18, rawHeightInch: 22, paperType: "Newspaper", gsm: 49, colour: "White", looseSheetRate: 0.8, reamRate: 330 },
    ],
  }
);
const backendVendorRaw = calculateCommercialPrintOrder({
  quantity: 10,
  pagesPerBook: 100,
  finishedWidth: 8.27,
  finishedHeight: 11.69,
  plyCount: 1,
  plyConfigurations: [
    { paperType: "Newspaper", gsm: 49, colour: "White", rawWidth: 18, rawHeight: 22, looseSheetRate: 0.8, reamRate: 330 },
  ],
  bindingType: "Normal Binding",
  bindingRate: 25,
  hasNumbering: false,
  targetMarginPercent: 0,
});
assert(
  sbbVendorRaw.finalOrderPrice === 604 &&
    backendVendorRaw.salesExecutiveView.pricing.subtotal === 604,
  "SalesBillBookEngine and Backend PrintingCalcEngine must both yield ₹604 Vendor Raw Price for A4 10x100 1-Ply 49GSM Newspaper"
);

// H. Least-Wastage DB Sheet Selector (Backend + Frontend Parity)
const dbCandidates = [
  { rawWidthInch: 18, rawHeightInch: 22, looseSheetRate: 1.5, reamRate: 700 },
  { rawWidthInch: 23, rawHeightInch: 36, looseSheetRate: 3.1, reamRate: 1400 },
  { rawWidthInch: 25, rawHeightInch: 36, looseSheetRate: 3.4, reamRate: 1550 },
];
const leastA4Backend = selectLeastWastageRawSheet({ finishedWidth: 8.27, finishedHeight: 11.69, candidateSheets: dbCandidates });
const leastA4Frontend = selectLeastWastageSheetFromDb(dbCandidates, 8.27, 11.69);
assert(
  leastA4Backend.rawWidthInch === 18 &&
    leastA4Backend.rawHeightInch === 22 &&
    leastA4Backend.bestYield === 4 &&
    leastA4Frontend.rawWidthInch === 18 &&
    leastA4Frontend.rawHeightInch === 22 &&
    leastA4Frontend.yieldPerSheet === 4,
  "For A4 (8.27x11.69), both backend and frontend must auto-pick 18x22 (4-out, least waste 2.3%)"
);

const leastLegalBackend = selectLeastWastageRawSheet({ finishedWidth: 8.5, finishedHeight: 14, candidateSheets: dbCandidates });
const leastLegalFrontend = selectLeastWastageSheetFromDb(dbCandidates, 8.5, 14);
assert(
  leastLegalBackend.rawWidthInch === 23 &&
    leastLegalBackend.rawHeightInch === 36 &&
    leastLegalBackend.bestYield === 6 &&
    leastLegalFrontend.rawWidthInch === 23 &&
    leastLegalFrontend.rawHeightInch === 36 &&
    leastLegalFrontend.yieldPerSheet === 6,
  "For Legal (8.5x14), both backend and frontend must auto-pick 23x36 (6-out, least waste 13.8%)"
);

// I. SalesBillBookEngine Punching / Perforation check
const sbbPunch = calculateSalesBillBookQuote(
  {
    sizeId: "a4",
    quantity: 10,
    setsPerBook: 100,
    plies: [{ paperType: "Newspaper", gsm: 49, colour: "White" }],
    bindingType: "normal",
    numbering: true,
    punching: true,
  },
  {
    papers: [
      { rawWidthInch: 18, rawHeightInch: 22, paperType: "Newspaper", gsm: 49, colour: "White", looseSheetRate: 0.8, reamRate: 330 },
    ],
  }
);
assert(
  sbbPunch.punchingCost === 20 && sbbPunch.finalOrderPrice === 644,
  "SalesBillBookEngine with numbering+punching on 10 books must add ₹20+₹20 (₹604 -> ₹644)"
);

console.log("\n=================================================");
console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log("=================================================");

if (passedTests === totalTests) {
  console.log("🎉 ALL PRINTING ENGINE CALCULATIONS & SECURITY FIREWALLS VERIFIED!");
  process.exit(0);
} else {
  process.exit(1);
}
