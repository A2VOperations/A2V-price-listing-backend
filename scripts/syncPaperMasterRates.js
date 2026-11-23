import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

import PaperMaster from "../models/PaperMaster.js";
import PaperRate from "../models/PaperRate.js";

async function syncPaperMasterRates() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error("❌ MONGODB_URI not found in environment.");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI);
    console.log("Connected to MongoDB:", mongoose.connection.name);

    const papers = await PaperMaster.find({});
    console.log(`Found ${papers.length} PaperMaster records in database.`);

    let updatedCount = 0;
    for (const paper of papers) {
      // Find latest or active rate for this paper
      const rate = await PaperRate.findOne({ paperId: paper._id, effectiveTill: null })
        .sort({ createdAt: -1 });

      let needsSave = false;

      if (!paper.paperType) {
        paper.paperType = "Maplitho";
        needsSave = true;
      }

      if (rate) {
        if (!paper.looseSheetRate || paper.looseSheetRate === 0) {
          paper.looseSheetRate = rate.looseSheetRate || 0;
          needsSave = true;
        }
        if (!paper.reamRate || paper.reamRate === 0) {
          paper.reamRate = rate.reamRate || 0;
          needsSave = true;
        }
      } else {
        // Provisional estimate if no rate found
        const baseEstimate = paper.rawWidthInch === 18 ? 600 : 1600;
        paper.reamRate = paper.reamRate || baseEstimate;
        paper.looseSheetRate = paper.looseSheetRate || Number(((paper.reamRate / 500) * 1.1).toFixed(2));
        needsSave = true;

        await PaperRate.create({
          paperId: paper._id,
          paperCode: paper.code,
          looseSheetRate: paper.looseSheetRate,
          reamRate: paper.reamRate,
          isProvisional: true,
          effectiveFrom: new Date(),
          effectiveTill: null,
          updatedBy: "sync_script",
          remarks: "Auto-synced provisional rate",
        });
      }

      if (needsSave) {
        await paper.save();
        updatedCount++;
      }
    }

    console.log(`✅ Successfully updated & synced ${updatedCount} PaperMaster records with rates.`);

    const sample = await PaperMaster.find({}).limit(5).lean();
    console.log("Sample synced papers:");
    sample.forEach((p) => {
      console.log(`- ${p.code}: ${p.rawWidthInch}x${p.rawHeightInch} ${p.paperType} ${p.gsm} GSM ${p.colour} -> Loose: ₹${p.looseSheetRate}, Ream: ₹${p.reamRate}`);
    });

    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  } catch (error) {
    console.error("Sync error:", error);
    process.exit(1);
  }
}

syncPaperMasterRates();
