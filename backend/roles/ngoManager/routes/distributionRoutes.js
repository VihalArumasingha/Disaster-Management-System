import express from 'express'
import {
    getOperations,
    getOperationById,
    createOperation,
    updateOperation,
    deleteOperation,
    getRecords,
    getRecordById,
    createRecord,
    updateRecord,
    deleteRecord
} from '../controllers/distributionController.js'
import authenticate from '../../../middleware/authentication/authMiddleware.js'
import authorize from '../../../middleware/authorization/roleMiddleware.js'
import { USER_ROLES } from '../../../utils/constants.js'

// ── /api/operations ───────────────────────────────────────────────
// Relief-distribution operations. GET is public (the NGO dashboard and the
// citizen mobile sign-up form both read the list — mobile expects `{ data }`);
// mutating routes require an NGO manager session.
const operationRouter = express.Router()

operationRouter.get('/', getOperations)
operationRouter.get('/:operationId', getOperationById)
// POST: public — same approach as volunteer creation (UI is gated by the layout)
operationRouter.post('/', createOperation)
operationRouter.put(
    '/:operationId',
    authenticate,
    authorize(USER_ROLES.ngomanager),
    updateOperation
)
operationRouter.delete(
    '/:operationId',
    authenticate,
    authorize(USER_ROLES.ngomanager),
    deleteOperation
)

// ── /api/distributionrecords ──────────────────────────────────────
// "Track Distribution Quantities" entries feeding the Distribution Trends chart.
const recordRouter = express.Router()

recordRouter.get('/', getRecords)
recordRouter.get('/:recordId', getRecordById)
recordRouter.post('/', createRecord)
recordRouter.put(
    '/:recordId',
    authenticate,
    authorize(USER_ROLES.ngomanager),
    updateRecord
)
recordRouter.delete(
    '/:recordId',
    authenticate,
    authorize(USER_ROLES.ngomanager),
    deleteRecord
)

export { operationRouter, recordRouter }