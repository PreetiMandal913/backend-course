//this file is the starting point
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import { app } from "./app.js";

//configuration for dotenv
dotenv.config({
    path: './env'
})

//if you call an async function... then you have to return a promise
connectDB()
.then(() => {
    //to start server
    app.listen(process.env.PORT || 8000, () => {
        console.log(`server is running at port : ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGODB connection failed!", err);
})














/*
//first approach
import express from "express";
const app = express()

//databae connection funciton in an eify function which will execute immediately
(async()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)

        //if database is connected but express is unable to talk to database... handling that error via express listeners
        app.on("error", (error)=>{
            console.log("ERROR: ", error);
            throw error
        })

        //if everything is okay
        //with the help of app.listen function... it will always listen to the port... it takes the port number and a callback
        app.listen(process.env.PORT,() => {
            console.log(`App is Listening on port ${process.env.PORT}`);
        })
    } catch (error) {
        console.error("ERROR", error)
        throw error
    }
})()*/