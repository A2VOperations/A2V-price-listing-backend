import {
  calculateCuttingYield,
  calculatePaperRequirement,
  calculateMiniOffsetCost,
  calculateDigitalCost,
  calculateBindingAndFinishingCost,
  calculateCommercialPrintOrder,
} from "../services/printingCalcEngine.js";

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

console.log("\n=================================================");
console.log(`🏁 TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log("=================================================");

if (passedTests === totalTests) {
  console.log("🎉 ALL PRINTING ENGINE CALCULATIONS & SECURITY FIREWALLS VERIFIED!");
  process.exit(0);
} else {
  process.exit(1);
}
