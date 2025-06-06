//For response we use Express... and express does not provide us such classes like 'Error' for 'Response'
//so we will create our own class
class ApiResponse {
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode
        this.data = data
        this.message = message
        this.success = statusCode < 400
    }
}