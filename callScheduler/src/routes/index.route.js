import { Router } from "express";
import leadRouter from "./lead.routes.js";
import webhookRouter from "./webhook.routes.js";

const router = Router();

// Structured paths
router.use("/leads", leadRouter);
router.use("/webhooks", webhookRouter);

export default router;
