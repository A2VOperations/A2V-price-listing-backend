import mongoose from "mongoose";
import "dotenv/config";
import PaperMaster from "../models/PaperMaster.js";
import PaperRate from "../models/PaperRate.js";
import PrintingRateMaster from "../models/PrintingRateMaster.js";
import BindingRateMaster from "../models/BindingRateMaster.js";
import FinishingRateMaster from "../models/FinishingRateMaster.js";

export async function seedPrintingMasters() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    throw new Error("MONGODB_URI not found in environment.");
  }

  console.log("🌱 [Seed] Initializing Printing Masters Seeding...");

  // 1. Raw Paper Sizes & GSM Matrix (Part 4.1 & 4.2)
  const paperConfigs = [
    // 18 x 22 inch
    { w: 18, h: 22, gsms: [58, 64, 70], colours: ["White", "Yellow", "Pink"] },
    // 23 x 36 inch
    { w: 23, h: 36, gsms: [70, 80, 90, 100, 115], colours: ["White", "Yellow", "Pink"] },
    // 25 x 36 inch
    { w: 25, h: 36, gsms: [70, 80, 90, 100, 115], colours: ["White", "Yellow", "Pink"] },
  ];

  // Base approximate ream rates for provisional initialization
  const reamPriceEstimates = {
    "18x22-58": 550,
    "18x22-64": 625,
    "18x22-70": 700,
    "23x36-70": 1400,
    "23x36-80": 1600,
    "23x36-90": 1800,
    "23x36-100": 2000,
    "23x36-115": 2300,
    "25x36-70": 1550,
    "25x36-80": 1750,
    "25x36-90": 1950,
    "25x36-100": 2200,
    "25x36-115": 2500,
  };

  let paperCount = 0;
  for (const config of paperConfigs) {
    for (const gsm of config.gsms) {
      for (const col of config.colours) {
        const code = `PAP-${config.w}${config.h}-${gsm}-${col.substring(0, 3).toUpperCase()}`;
        const paperDoc = await PaperMaster.findOneAndUpdate(
          { code },
          {
            $set: {
              code,
              rawWidthInch: config.w,
              rawHeightInch: config.h,
              gsm,
              gsmLabel: `${gsm} GSM`,
              colour: col,
              paperType: "Maplitho",
              isDigitalCompatible: col === "White",
              isActive: true,
            },
          },
          { upsert: true, new: true }
        );

        // Seed initial rate version if not present
        const key = `${config.w}x${config.h}-${gsm}`;
        const estimatedReam = reamPriceEstimates[key] || 1000;
        const colorPremium = col === "White" ? 0 : 25; // Slight color tint difference
        const finalReam = estimatedReam + colorPremium;
        const finalLoose = Number(((finalReam / 500) * 1.1).toFixed(2)); // +10% for loose margin

        await PaperRate.findOneAndUpdate(
          { paperId: paperDoc._id, effectiveTill: null },
          {
            $set: {
              paperId: paperDoc._id,
              paperCode: code,
              looseSheetRate: finalLoose,
              reamRate: finalReam,
              isProvisional: true,
              updatedBy: "seed_system",
              remarks: "Initial provisional rate from V1.0 discovery draft",
            },
          },
          { upsert: true, new: true }
        );
        paperCount++;
      }
    }
  }
  console.log(`✅ Seeded/Verified ${paperCount} Paper Master & Rate combinations.`);

  // 2. Printing Rate Master (Mini Offset & Digital Rates)
  const printingRates = [
    // Part 7.2: Mini Offset Master Making
    {
      processType: "mini_offset",
      rateKey: "OFFSET_MASTER_LEGAL",
      name: "Mini Offset Master Making (Legal Size)",
      rate: 30, // ₹30 per unique design / ink colour
      unit: "per_master",
      sheetSize: "Legal",
      description: "Laser printed Legal master for Mini Offset machine",
    },
    // Part 7.4: Mini Offset Machine Running
    {
      processType: "mini_offset",
      rateKey: "OFFSET_RUN_PER_1000",
      name: "Mini Offset Machine Run (Per 1,000 Impressions)",
      rate: 70, // ₹70 per 1,000 impressions per machine run
      unit: "per_1000_impressions",
      slabImpressions: 1000,
      description: "1 Run = 1 Paper Layer + 1 Ink Colour + 1 Side",
    },
    // Part 8.2: Digital 12x18
    {
      processType: "digital",
      rateKey: "DIGITAL_12X18_FRONT",
      name: "Digital 12×18 Sheet - Front Only",
      rate: 6,
      unit: "per_sheet",
      sheetSize: "12x18",
      description: "Direct full colour digital print, front only",
    },
    {
      processType: "digital",
      rateKey: "DIGITAL_12X18_BOTH",
      name: "Digital 12×18 Sheet - Both Sides",
      rate: 7,
      unit: "per_sheet",
      sheetSize: "12x18",
      description: "Direct full colour digital print, both sides combined",
    },
    // Part 8.2: Digital 13x19
    {
      processType: "digital",
      rateKey: "DIGITAL_13X19_FRONT",
      name: "Digital 13×19 Sheet - Front Only",
      rate: 7,
      unit: "per_sheet",
      sheetSize: "13x19",
      description: "Direct full colour digital print, front only",
    },
    {
      processType: "digital",
      rateKey: "DIGITAL_13X19_BOTH",
      name: "Digital 13×19 Sheet - Both Sides",
      rate: 9,
      unit: "per_sheet",
      sheetSize: "13x19",
      description: "Direct full colour digital print, both sides combined",
    },
  ];

  for (const pr of printingRates) {
    await PrintingRateMaster.findOneAndUpdate(
      { rateKey: pr.rateKey },
      { $set: pr },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded/Verified ${printingRates.length} Printing Rates (Mini Offset + Digital).`);

  // 3. Binding Rate Master (Part 9)
  const bindingRates = [
    {
      bindingType: "Normal Binding",
      bindingCode: "BIND_NORMAL_A4",
      finishedSizeCategory: "A4",
      ratePerUnit: 25, // ₹25 per book for A4 (includes cover, card sheet, gatta, finishing)
      unitType: "per_book",
      includesCoverAndGatta: true,
      description: "Standard book binding with outer cover, card sheet & gatta",
    },
    {
      bindingType: "Normal Binding",
      bindingCode: "BIND_NORMAL_A5",
      finishedSizeCategory: "A5",
      ratePerUnit: 18,
      unitType: "per_book",
      includesCoverAndGatta: true,
      description: "Standard book binding for A5 size",
    },
    {
      bindingType: "Stapler Binding",
      bindingCode: "BIND_STAPLER",
      finishedSizeCategory: "All",
      ratePerUnit: 12,
      unitType: "per_book",
      includesCoverAndGatta: true,
      description: "Center stapled or side wire stitched binding",
    },
    {
      bindingType: "Gumming",
      bindingCode: "BIND_GUMMING_PAD",
      finishedSizeCategory: "All",
      ratePerUnit: 10,
      unitType: "per_pad",
      includesCoverAndGatta: false,
      description: "Top glue gumming for Writing Pads & Memo slips",
    },
    {
      bindingType: "Glue Binding",
      bindingCode: "BIND_GLUE",
      finishedSizeCategory: "All",
      ratePerUnit: 20,
      unitType: "per_book",
      includesCoverAndGatta: true,
      description: "Hot melt perfect glue spine binding",
    },
    {
      bindingType: "Premium Binding",
      bindingCode: "BIND_PREMIUM",
      finishedSizeCategory: "All",
      ratePerUnit: 35,
      unitType: "per_book",
      includesCoverAndGatta: true,
      description: "Hardbound board with rexine cloth strip or metallic corners",
    },
  ];

  for (const br of bindingRates) {
    await BindingRateMaster.findOneAndUpdate(
      { bindingCode: br.bindingCode },
      { $set: br },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded/Verified ${bindingRates.length} Binding Rates.`);

  // 4. Finishing Rate Master (Part 10)
  const finishingRates = [
    {
      serviceType: "numbering",
      serviceKey: "FINISH_NUMBERING",
      name: "Serial Numbering (Continuous across books, synchronized across plies)",
      ratePerBook: 2, // ₹2 per book
      description: "Mechanical red/black serial numbering stamped across all plies",
    },
    {
      serviceType: "punching",
      serviceKey: "FINISH_PUNCHING",
      name: "Punching / Perforation (In binding area)",
      ratePerBook: 2, // ₹2 per book
      description: "Perforation line inside margin for easy tear-off",
    },
  ];

  for (const fr of finishingRates) {
    await FinishingRateMaster.findOneAndUpdate(
      { serviceKey: fr.serviceKey },
      { $set: fr },
      { upsert: true, new: true }
    );
  }
  console.log(`✅ Seeded/Verified ${finishingRates.length} Finishing Rates (Numbering & Punching).`);
  console.log("🎉 [Seed] All Printing Masters Seeded Successfully!");
}

// Standalone execution support
if (process.argv[1]?.endsWith("seedPrintingMasters.js")) {
  mongoose
    .connect(process.env.MONGODB_URI, { dbName: "A2V-Pricing" })
    .then(async () => {
      await seedPrintingMasters();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Seed Error:", err);
      process.exit(1);
    });
}
