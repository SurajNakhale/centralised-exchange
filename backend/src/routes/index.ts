import { Router } from "express";
import { authRouter } from "./auth-routes.js";
import { exchangeRouter } from "./exchange-routes.js";

const appRouter = Router();

appRouter.use(authRouter);
appRouter.use(exchangeRouter);


export default appRouter;
