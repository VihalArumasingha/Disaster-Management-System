const errorMiddleware = (err, req, res, next) => {
    console.error(err)

    const statusCode = err.statusCode || (
        res.statusCode === 200
            ? 500
            : res.statusCode
    )

    res.status(statusCode).json({
        success: false,
        message: statusCode >= 500
            ? 'Internal server error'
            : err.message
    })
}

export default errorMiddleware