import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

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

    if(!incomingRefreshToken) {
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

//function for change password
const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200).json(new ApiResponse(200, {}, "Password changes successfully"))
})

const getCurrentUser = asyncHandler(async(req, res)=>{
    return res.status(200).json(200, req.user, "current user fetched successfully")
})

//update account
const updateAccountDetails = asyncHandler(async(req, res)=>{
    const {fullName, email} = req.body

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully"))
})

//update files like profile and thumbnail
const updateUserAvatar = asyncHandler(async(req, res) => {
    //file because we take only one file for avatar... files if it is plural
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler(async(req, res) => {
    //file because we take only one file for avatar... files if it is plural
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url) {
        throw new ApiError(400, "Error while uploading on cover Image")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200).json(new ApiResponse(200, user, "Cover Image updated successfully"))
})

//fuction for getting user subscriber and subscribed count 
const getUserChannelProfile = asyncHandler(async(req, res) => {
    const {username} = req.params

    if(!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }
    
    //using aggregation pipeline
    const channel = await User.aggregate([
        {
            //fetch the data from database where username = username
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            //this will copy paste whole data instead of id in file
            //lookup in user database 
            $lookup: {
                from: "subscriptions", //Subscription becomes subscriptions in mongodb
                localField: "_id", //local field is _id in user database
                foreignField: "channel", //foreign field is channel in subscription database
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            //this will add extra fields in user database for subscribers count and subscribed count
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        //this will project these fields only
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ])

    if(!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res.status(200).json(new ApiResponse(200, channel[0], "User channel fetched successfully"))
})

//imp note - when we use 'req.user._id' we get only string which is not actual mongodb id. mongodb id is in the form of ObjectId('ajkjfahejh') something like this
//which is internally handled by mongoose automatically when we give only string
//but in pipelining we have to convert this string to object to be handled because aggregation pipeline's code goes directly
const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                //so here we change that string to object
                _id: new mongoose.Types.ObjectId(req.user._id)
            },
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                //writing subpipelining
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            //we could have use this pipeline outside but we want to project fields inside owner field
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200).json(new ApiResponse(200, user[0].watchHistory, "watch history fetched successfully"))
})

export {
    registerUser,
    loginUser,
    loggedOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}