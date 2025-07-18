//this is a wrapper function utility in which we accept a function, execute it, and return it in promises
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).
        catch((err) => next(err))
    }
}

export {asyncHandler}


//higher order function which accepts function as a parameter or return a function
//steps to understand
//const asyncHandler = () => {}
//const asyncHandler = (func) => ()=>{}
//const asyncHandler = (func) => async ()=>{}

//using try catch
/*const asyncHandler = (fn) => async (req, res, next) => {
    try {
        await fn(req, res, next)
    } catch (error) {
        res.status(err.code || 500).json({
            success: false,
            message: err.message
        })
    }
}*/