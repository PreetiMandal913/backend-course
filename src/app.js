import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

//cors configuration
//read documentation for more knowledge
app.use(cors({
    //who can contact to our backend?
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

//this tells... in which format you will accept your data after form filling and it's size (according to the sever)
app.use(express.json({limit: "16kb"}))
//configuring the url encoder (extended means nested objects) and it's limit
app.use(express.urlencoded({extended: true, limit: "16kb"}))
//static config to store some files in server and we are storing it in public folder so you can change the folder name
app.use(express.static("public"))
//storing and retrieving cookies from user's browser
app.use(cookieParser())

//routes import
import userRouter from './routes/user.route.js'

//routes declaration
//url - http://localhost:8000/api/v1/users/register standard practice
app.use("/api/v1/users", userRouter)

export { app }