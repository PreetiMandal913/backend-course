import mongoose, {Schema} from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true     //enable index true for searchable fields, for optimization purpose but makes it quite expensive
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true 
        },
        fullName: {
            type: String,
            required: true,
            trim: true,
            index: true
        },
        avatar: {
            type: String,       //cloudinary url
            required: true
        },
        coverImage: {
            type: String      //cloudinary url
        },
        watchHistory: [
            {
                type: Schema.Types.ObjectId,    //referencing objectid from video schema (array of objects)
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required: [true, 'Password is required']    //custom message
        },
        refreshToken: {
            type: String
        }
    },
    {
        timestamps: true
    }
)

//it is a pre hook... we can use it just before save the data that's why we use "save"
//arrow function does not have this reference that's why we can't use arrow function in this
//ecryption is time consuming process that's why we use async here
userSchema.pre("save", async function(next) {
    //this will check if the password is modified or not with the help of built in function "isModified"
    //other wise it will save everytime user change anything in the data
    if(!this.isModified("password")) return next();  
    this.password = bcrypt.hash(this.password, 10) //this function will hash the password and we have to provide a number
    next()
})

//we can create custom method using "methods" object and then . and mehtod name
//this function is comparing password given by user and stored hashed password using compare method in bycrypt
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password) //this will return value in true or false
}

//This function from the jsonwebtoken library creates (signs) a token.
//jwt.sign(payload, secretOrPrivateKey, [options])
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            //These are the user details that will be embedded in the JWT. They can be decoded later to verify the user's identity.
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema)