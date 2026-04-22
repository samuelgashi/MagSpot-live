import { Router } from "express";
import { proxyFlask } from "../lib/flaskProxy";

const router = Router();

router.get("/groups", (req, res) => proxyFlask(req, res, "/groups"));

router.post("/groups", (req, res) => proxyFlask(req, res, "/groups"));

router.get("/groups/:id", (req, res) => proxyFlask(req, res, `/groups/${req.params.id}`));

router.put("/groups/:id", (req, res) => proxyFlask(req, res, `/groups/${req.params.id}`));

router.delete("/groups/:id", (req, res) => proxyFlask(req, res, `/groups/${req.params.id}`));

export default router;
