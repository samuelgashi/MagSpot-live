import { Router, type IRouter } from "express";
import healthRouter from "./health";
import devicesRouter from "./devices";
import groupsRouter from "./groups";
import tasksRouter from "./tasks";

const router: IRouter = Router();

router.use(healthRouter);
router.use(devicesRouter);
router.use(groupsRouter);
router.use(tasksRouter);

export default router;
