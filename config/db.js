import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/a2v_prints";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.warn(
      `MongoDB Connection Warning: ${error.message}. (Server will proceed with fallback file storage if database is offline)`
    );
    return false;
  }
};
