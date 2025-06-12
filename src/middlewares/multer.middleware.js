//we'll create this middleware to upload the file and inject where's required
//read documentation for multer to learn more
import multer from "multer";

//diskStorage is used to store the file temporarily to local server
//cb is the callback
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        //giving the path where the file to be stored temporarily
        cb(null, "./public/temp")
    },
    //setting the file name
    filename: function(req, file, cb) {
        cb(null, file.originalname)
    }
})

export const upload = multer({
    storage
})