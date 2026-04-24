import { Router } from "express";
import { proxyFlask } from "../lib/flaskProxy";

const router = Router();

router.get("/tasks", (req, res) => proxyFlask(req, res, "/task_templates"));

router.post("/tasks", (req, res) => proxyFlask(req, res, "/task_templates"));

router.get("/tasks/:id", (req, res) => proxyFlask(req, res, `/task_templates/${req.params.id}`));

router.put("/tasks/:id", (req, res) => proxyFlask(req, res, `/task_templates/${req.params.id}`));

router.delete("/tasks/:id", (req, res) => proxyFlask(req, res, `/task_templates/${req.params.id}`));

export default router;
