import { Router } from "express";
import authRoutes from "./authRoutes.js";
import hisRoutes from "./hisRoutes.js";
import tokenRoutes from "./tokenRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/his", hisRoutes);
router.use("/tokens", tokenRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
