import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../../library/async-handler";
import { authenticateRequest } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validation.middleware";
import { sendSuccess } from "../../library/response";
import { feedbackSubmitRating } from "./feedback.service";

const router = Router();

const submitFeedbackSchema = {
  body: z.object({
    rating: z.number().int().min(1).max(5),
    message: z.string().trim().max(1000).optional(),
    category: z.string().trim().max(100).optional(),
  }),
};

router.post(
  "/",
  authenticateRequest,
  authorizeRoles("passenger"),
  validate(submitFeedbackSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await feedbackSubmitRating({
      userId: req.authUser!.userId,
      ...req.body,
    });
    sendSuccess(res, null, "Feedback submitted");
  }),
);

export default router;
