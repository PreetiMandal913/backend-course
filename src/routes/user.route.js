import { Router } from "express";
import { loggedOutUser, loginUser, registerUser } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

//this will pass the control to user.controller.js
//injecting multer middleware for file handling
router.route("/register").post(
    //upload.fields take array so we are passing array of objects which is our images with their name and maxCount
    upload.fields([ 
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser)

router.route("/login").post(loginUser)

//secured routes
router.route("/logout").post(verifyJWT, loggedOutUser)

export default router