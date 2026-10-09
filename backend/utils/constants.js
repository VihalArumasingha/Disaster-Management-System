export const USER_ROLES = {
    citizen: 'citizen',
    dmcofficer: 'dmcofficer',
    dutyofficer: 'dutyofficer',
    ngomanager: 'ngomanager',
    organization: 'organization'
}

export const normalizeRole = (role) => {
    if (typeof role !== 'string') return ''
    return role.toLowerCase().replace(/[\s_-]/g, '')
}