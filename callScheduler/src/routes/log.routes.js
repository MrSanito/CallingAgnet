import { Router } from "express";
import { getLogs } from "../controllers/log.controller.js";

const router = Router();

// GET /api/v1/logs
router.get("/", getLogs);

export default router;
