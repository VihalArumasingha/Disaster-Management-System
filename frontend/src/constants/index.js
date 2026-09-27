export const USER_ROLES = {
    CITIZEN: 'CITIZEN',
    DMC_OFFICER: 'DMC_OFFICER',
    DUTY_OFFICER: 'DUTY_OFFICER',
    NGO_MANAGER: 'NGO_MANAGER'
}

export const API_BASE_URL =
    import.meta.env.VITE_API_URL || 'http://localhost:5000/api'