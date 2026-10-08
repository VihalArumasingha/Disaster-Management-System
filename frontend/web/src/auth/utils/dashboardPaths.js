import { USER_ROLES } from '../../constants/roles'

export const dashboardPathForRole = (role) => {
    if (role === USER_ROLES.dmcofficer) return '/dmcofficer/dashboard'
    if (role === USER_ROLES.dutyofficer) return '/dutyofficer/dashboard'
    if (role === USER_ROLES.ngomanager) return '/ngomanager/dashboard'
    if (role === USER_ROLES.organization) return '/organization/dashboard'
    return '/login'
}
