const uploadMiddleware = (req, res, next) => {
    if (req.file || req.files) {
        return next()
    }

    return res.status(501).json({
        success: false,
        message:
            'Photo upload is not configured yet.'
    })
}

export default uploadMiddleware