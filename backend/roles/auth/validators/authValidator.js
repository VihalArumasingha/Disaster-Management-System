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
        const { name } = req.body
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Name is required'
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