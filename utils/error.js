

export const createError = (statusCode, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  error.response = {
    success: false,
    message
  }
  return error
}


// utils/responseError.js
export class ResponseError extends Error {
  constructor(statusCode, success = false, message) {
    super(message)
    this.statusCode = statusCode
    this.success = success
    this.message = message
  }
}

export const throwResponse = (statusCode, message) => {
  throw new ResponseError(statusCode, false, message)
}