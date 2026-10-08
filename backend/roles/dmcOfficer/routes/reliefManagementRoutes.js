import express from 'express'
import {
    createReliefDistribution,
    createReliefSupply,
    listReliefDistributions,
    listReliefSupplyOptions,
    listReliefSupplies,
    updateReliefDistributionAudit
} from '../controllers/reliefManagementController.js'

const router = express.Router()

router.get('/relief-supplies/options', listReliefSupplyOptions)
router.get('/relief-supplies', listReliefSupplies)
router.post('/relief-supplies', createReliefSupply)
router.get('/relief-distributions', listReliefDistributions)
router.post('/relief-distributions', createReliefDistribution)
router.patch('/relief-distributions/:distributionId/audit', updateReliefDistributionAudit)

export default router
