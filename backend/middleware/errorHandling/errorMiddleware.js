import mongoose from 'mongoose'

const isProduction = process.env.NODE_ENV === 'production'

const getStatusCode = (
    error,
    fallbackStatusCode
) => {
    if (
        Number.isInteger(error?.statusCode)
        && error.statusCode >= 400
    ) {
        return error.statusCode
    }

    if (error instanceof mongoose.Error.ValidationError) {
        return 400
    }

    if (error instanceof mongoose.Error.CastError) {
        return 400
    }

    if (error?.code === 11000) {
        return 409
    }

    return fallbackStatusCode
}

const getErrorMessage = (
    error,
    statusCode
) => {
    if (statusCode >= 500) {
        return isProduction
            ? 'Internal server error'
            : error.message || 'Internal server error'
    }

    return error.message || 'Request failed'
}

const errorMiddleware = (
    error,
    req,
    res,
    next
) => {
    const fallbackStatusCode =
        res.statusCode && res.statusCode !== 200
            ? res.statusCode
            : 500

    const statusCode = getStatusCode(
        error,
        fallbackStatusCode
    )

    if (!isProduction) {
        console.error(error)
    }

    res.status(statusCode).json({
        success: false,
        message: getErrorMessage(
            error,
            statusCode
        )
    })
}

export default errorMiddleware