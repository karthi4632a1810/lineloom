import mongoose from "mongoose";
import { env } from "./env.js";

export const connectMongo = async () => {
  await mongoose.connect(env.mongoUri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000
  });
};
