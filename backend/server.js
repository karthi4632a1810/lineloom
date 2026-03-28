import cors from "cors";
import express from "express";
import helmet from "helmet";
import { connectMongo } from "./config/mongo.js";
import { env } from "./config/env.js";
import router from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorMiddleware.js";
import { logger } from "./utils/logger.js";

const app = express();

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    data: { uptime_seconds: Math.floor(process.uptime()) }
  });
});

app.use("/", router);
app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectMongo();
    app.listen(env.port, () => {
      logger.info("Server started", { port: env.port });
    });
  } catch (error) {
    logger.error("Failed to start server", {
      message: error?.message ?? "Unknown startup error"
    });
    process.exit(1);
  }
};

startServer();
