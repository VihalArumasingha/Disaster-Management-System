import OperationalAuditLog from '../models/OperationalAuditLog.js'

const writeOperationalAudit = async ({ actor, action, entityType, entityId = null, details = {} }) => {
    if (!actor) throw new Error('An authenticated actor is required to write an operational audit log.')
    await OperationalAuditLog.create({ actor, action, entityType, entityId, details })
}

export default writeOperationalAudit
