import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";

const router = Router()

//this will pass the control to user.controller.js
router.route("/register").post(registerUser)

export default router