import { Router } from "express";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import {
  bookRoute,
  planRoute,
  routeCreate,
  routeDelete,
  routeGetAll,
  routePublish,
  routeUpdate,
} from "./routes.controller";
import {
  bookRouteBodySchema,
  createRouteBodySchema,
  planRouteQuerySchema,
  routeIdParamSchema,
  updateRouteBodySchema,
} from "./routes.validation";

const router = Router();

router.get("/", authenticateRequest, authorizeRoles("admin", "staff"), routeGetAll);
router.post("/", authenticateRequest, authorizeRoles("admin", "staff"), validate({ body: createRouteBodySchema }), routeCreate);
router.patch("/:routeId", authenticateRequest, authorizeRoles("admin", "staff"), validate({ body: updateRouteBodySchema, params: routeIdParamSchema }), routeUpdate);
router.delete("/:routeId", authenticateRequest, authorizeRoles("admin", "staff"), validate({ params: routeIdParamSchema }), routeDelete);
router.post("/:routeId/publish", authenticateRequest, authorizeRoles("admin", "staff"), validate({ params: routeIdParamSchema }), routePublish);

router.use(authenticateRequest, authorizeRoles("passenger"));
router.get("/plan", validate({ query: planRouteQuerySchema }), planRoute);
router.post("/book", validate({ body: bookRouteBodySchema }), bookRoute);

export default router;
