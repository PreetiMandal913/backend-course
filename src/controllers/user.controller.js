import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler(async (req, res) => {
    //1. get user details from frontend
    
    //we get form or json data in req.body
    //destructuring data
    const {fullName, email, username, password} = req.body
    console.log("email: ", email)

    //validation - not empty
    if(
        [fullName, email, username, password].some((field)=>
            field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    //2. check if user already exists: username, email

    //findOne fuction returns the first match based on query it gets
    const existedUser = User.findOne({
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
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

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

export {registerUser}