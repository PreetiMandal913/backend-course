import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens  = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        //don't validate anything before saving the refresh token because we don't want anything else to be saved in login process
        //so we use validateBeforeSave option as false to prevent this
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

//user register
const registerUser = asyncHandler(async (req, res) => {
    //1. get user details from frontend
    
    //we get form or json data in req.body
    //destructuring data
    const {fullName, email, username, password} = req.body

    //validation - not empty
    if(
        [fullName, email, username, password].some((field)=>
            field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    //2. check if user already exists: username, email

    //findOne fuction returns the first match based on query it gets
    const existedUser = await User.findOne({
        //we can user operators using $ sign
        $or: [{username}, {email}]
    })
    if(existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    //3. check for images, check for avatar

    //we have injected the multer middleware... so it gives the access to files
    //we have used chaining that if the file exists then return the file path
    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    //are we getting req.files or not and req.files.coverImage is an array or not and req.files.coverImage.length is greater than 0 or not
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    //4. upload them to cloudinary, avatar

    //we already created cloudinary.js utils for this purpose so will simply use that
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }

    //4. create user object - create entry in db
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    //5. remove password and refresh token field from response
    //6. check for user creation

    //check if user is created or not and by chaining will also remove password and refresh token from response using select method
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //if not created throw error
    if(!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }
    
    //7. return response

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

//login user
const loginUser = asyncHandler(async(req, res)=>{
    //1. req body -> data
    const {email, username, password} = req.body
    
    //2. username or email
    if(!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    //3. find the user
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user) {
        throw new ApiError(404, "User does not exist")
    }

    //4. check password
    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid password")
    }

    //5. access and refresh token
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    //6. send cookie
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //for cookies we have to define some options
    //by default cookie is modifiable from frontend that's why we are protecting them so that this only will be modifiable from server
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            //data field
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )

})

//log out
const loggedOutUser = asyncHandler(async(req, res) => {
    //now we have the access for req.user because auth middleware has been executed before this logged out function
    await User.findByIdAndUpdate(
        req.user._id, //query
        //update object
        {
            $set: {
                refreshToken: undefined
            }
        },
        //return new updated response
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"))
})

//regenerating refresh and access token so that user don't have to login again and again
const refreshAccessToken = asyncHandler(async(req, res) =>{
    //accessing refresh token from cookies or body
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

    try {
        //getting decoded token
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        //getting id
        const user = await User.findById(decodedToken?._id)
    
        if(!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        //matching incoming token and stored refresh token
        if(incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        //generating new tokens
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newrefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
})

export {
    registerUser,
    loginUser,
    loggedOutUser,
    refreshAccessToken
}