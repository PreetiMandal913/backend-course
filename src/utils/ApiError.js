//creating this file to standarize error by overriding Error class which is provided by node
class ApiError extends Error{
    //overriding constructor
    constructor(
        statusCode,
        message = "Something went wrong", //if message is not passed
        errors = [],
        stack = ""
    ){
        super(message)
        this.statusCode = statusCode
        this.data = null
        this.message = message
        this.success = false
        this.errors = errors

        //tracing stacks, tracing files in which errors are found
        if(stack) {
            this.stack = stack
        } else{
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

export {ApiError}