import {
  SALES_BOOK_SIZE_RULES,
  calculateSalesBillBookQuote,
  resolvePaperRates,
  getPapersForSizeRule,
} from "../../frontend/src/utils/salesBillBookEngine.js";

console.log("=================================================");
console.log("🧪 TESTING SALESPERSON BILL BOOK CALCULATION ENGINE");
console.log("=================================================");

let passed = 0;
let total = 0;

function assert(condition, message) {
  total++;
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
  }
}

// 1. Test Fixed Sheet Size Rules - All 13 User-Requested Sizes
const expected13Sizes = [
  { id: "a4", name: "A4", w: 8.27, h: 11.69 },
  { id: "a5", name: "A5", w: 5.83, h: 8.27 },
  { id: "a6", name: "A6", w: 4.13, h: 5.83 },
  { id: "letter", name: "Letter", w: 8.5, h: 11.0 },
  { id: "half-letter", name: "Half Letter", w: 5.5, h: 8.5 },
  { id: "legal", name: "Legal", w: 8.5, h: 14.0 },
  { id: "1-4", name: "1/4", w: 8.5, h: 10.5 },
  { id: "1-5", name: "1/5", w: 6.0, h: 7.9 },
  { id: "1-6", name: "1/6", w: 7.0, h: 8.5 },
  { id: "1-8", name: "1/8", w: 5.5, h: 7.0 },
  { id: "1-10", name: "1/10", w: 3.6, h: 6.0 },
  { id: "1-12", name: "1/12", w: 4.13, h: 7.09 },
  { id: "1-16", name: "1/16", w: 4.13, h: 5.12 },
];

for (const exp of expected13Sizes) {
  const rule = SALES_BOOK_SIZE_RULES.find((r) => r.id === exp.id);
  assert(rule !== undefined, `Size rule for ${exp.name} (${exp.id}) must exist`);
  if (rule) {
    assert(
      rule.widthInch === exp.w && rule.heightInch === exp.h,
      `${exp.name} dimensions must be ${exp.w} × ${exp.h}`
    );
    assert(rule.yieldPerSheet > 0, `${exp.name} yield must be > 0 (${rule.yieldPerSheet} per sheet)`);
  }
}

// 2. Test Wastage Sheets (5 sheets per layer rule)
const testQuote1 = calculateSalesBillBookQuote({
  sizeId: "a4",
  quantity: 10,
  setsPerBook: 100,
  plies: [
    { paperType: "Maplitho", gsm: 70, colour: "White" },
    { paperType: "Maplitho", gsm: 70, colour: "Yellow" },
  ],
});

assert(testQuote1.success === true, "Calculation must succeed");
assert(testQuote1.numPlies === 2, "Plies count must be 2");
// 10 books * 100 sets = 1000 finished pages per ply
// A4 yield = 4 pages per raw sheet
// Net raw sheets = 1000 / 4 = 250 sheets
assert(testQuote1.plyBreakdown[0].netSheets === 250, "Net sheets per ply must be 250");
assert(testQuote1.plyBreakdown[0].wastageSheets === 5, "Wastage sheets must be 5 per layer");
assert(testQuote1.plyBreakdown[0].totalSheets === 255, "Total raw sheets per ply must be 255 (250 net + 5 wastage)");
assert(testQuote1.totalRawSheetsOrder === 510, "Total order raw sheets for 2 plies must be 510");

// 3. Test Paper Matching with live master data
const mockPapers = [
  { rawWidthInch: 18, rawHeightInch: 22, paperType: "Maplitho", gsm: 70, colour: "White", looseSheetRate: 1.5, reamRate: 700 },
  { rawWidthInch: 18, rawHeightInch: 22, paperType: "Maplitho", gsm: 70, colour: "Yellow", looseSheetRate: 1.6, reamRate: 720 },
  { rawWidthInch: 18, rawHeightInch: 22, paperType: "Newspaper", gsm: 58, colour: "White", looseSheetRate: 1.2, reamRate: 520 },
];

const testQuote2 = calculateSalesBillBookQuote(
  {
    sizeId: "a4",
    quantity: 10,
    setsPerBook: 100,
    plies: [
      { paperType: "Maplitho", gsm: 70, colour: "White" },
      { paperType: "Maplitho", gsm: 70, colour: "Yellow" },
    ],
    numbering: true,
    bindingType: "normal",
  },
  { papers: mockPapers }
);

// Ply 1: 255 loose sheets @ 1.5 = 382.5
// Ply 2: 255 loose sheets @ 1.6 = 408.0
// Total Paper: 790.5
assert(testQuote2.plyBreakdown[0].cost === 382.5, "Ply 1 cost must be 382.5 (255 * 1.5)");
assert(testQuote2.plyBreakdown[1].cost === 408, "Ply 2 cost must be 408 (255 * 1.6)");
assert(testQuote2.totalPaperCost === 790.5, "Total paper cost must be 790.5");
assert(testQuote2.numbering === true, "Numbering must be enabled");
assert(testQuote2.numberingCost === 20, "10 books @ ₹2 numbering = ₹20");
assert(testQuote2.bindingCost === 250, "10 books @ ₹25 normal binding = ₹250");
assert(testQuote2.finalOrderPrice > 0, "Final order price must be calculated");
assert(testQuote2.pricePerBook > 0, "Price per book must be calculated");
assert(Math.round(testQuote2.pricePerBook * 10) === testQuote2.finalOrderPrice, "Price per book must match order total");

console.log("=================================================");
console.log(`🏁 TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
console.log("=================================================");
if (passed === total) {
  console.log("🎉 ALL SALES BILL BOOK ENGINE TESTS PASSED!");
  process.exit(0);
} else {
  process.exit(1);
}
