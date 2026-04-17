import { Router } from "express";
import authRoutes from "./authRoutes.js";
import hisRoutes from "./hisRoutes.js";
import tokenRoutes from "./tokenRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import departmentRoutes from "./departmentRoutes.js";
import journeyRoutes from "./journeyRoutes.js";
import alertRoutes from "./alertRoutes.js";
import intelligenceRoutes from "./intelligenceRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/his", hisRoutes);
router.use("/tokens", tokenRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/departments", departmentRoutes);
router.use("/journey", journeyRoutes);
router.use("/alerts", alertRoutes);
router.use("/intelligence", intelligenceRoutes);

export default router;
