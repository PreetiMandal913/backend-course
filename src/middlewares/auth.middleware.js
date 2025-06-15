import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async(req, res, next) => {
    //req have cookie access
    //cookie have access and refresh token
    //will take token from cookie to retrieve user details because we have save user details in token 
    //may be user send the token that's why we are checking header for that token
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "") //replace bearer with empty string to retrieve token only
    
        if(!token) {
            throw new ApiError(401, "Unauthorized request")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!user) {
            //discussion about frontend
            throw new ApiError(401, "Invalid Access Token")
        }
    
        //adding object in request
        req.user = user;
        next()
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token")
    }

})