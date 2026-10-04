const validateAuthInput = (req, res, next) => {
    const { email, password } = req.body

    const isRegister = req.path === '/register'
    const invalidPassword = typeof password !== 'string'
        || password.length === 0
        || (isRegister && password.length < 8)
        || (typeof password === 'string' && Buffer.byteLength(password, 'utf8') > 72)

    if (
        typeof email !== 'string'
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        || invalidPassword
    ) {
        return res.status(400).json({
            success: false,
            message: isRegister
                ? 'Enter a valid email and a password between 8 and 72 bytes'
                : 'Enter a valid email and password'
        })
    }

    if (isRegister) {
        const { name, phone, location } = req.body
        const phoneDigits = typeof phone === 'string'
            ? phone.replace(/\D/g, '').length
            : 0

        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Name is required'
            })
        }

        if (
            typeof phone !== 'string'
            || !/^\+?[0-9\s().-]+$/.test(phone.trim())
            || phoneDigits < 7
            || phoneDigits > 15
        ) {
            return res.status(400).json({
                success: false,
                message: 'Enter a valid phone number with 7 to 15 digits'
            })
        }

        if (
            location !== undefined
            && (
                !location
                || !Number.isFinite(location.latitude)
                || location.latitude < -90
                || location.latitude > 90
                || !Number.isFinite(location.longitude)
                || location.longitude < -180
                || location.longitude > 180
            )
        ) {
            return res.status(400).json({
                success: false,
                message: 'Location must contain valid latitude and longitude coordinates'
            })
        }
    }

    if (
        req.path === '/login'
        && !['mobile', 'web'].includes(req.body.client)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Choose a valid sign-in portal'
        })
    }

    next()
}

export default validateAuthInput