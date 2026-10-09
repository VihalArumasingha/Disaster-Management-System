import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../models/CollectingCenter.js', () => ({
    default: { countDocuments: vi.fn(), find: vi.fn() }
}))
vi.mock('../../models/DistributionOperation.js', () => ({
    default: { countDocuments: vi.fn(), find: vi.fn() }
}))
vi.mock('../../models/Volunteer.js', () => ({
    default: { countDocuments: vi.fn() }
}))
vi.mock('../../models/Warning.js', () => ({
    default: { countDocuments: vi.fn() }
}))

import CollectingCenter from '../../models/CollectingCenter.js'
import DistributionOperation from '../../models/DistributionOperation.js'
import Volunteer from '../../models/Volunteer.js'
import Warning from '../../models/Warning.js'
import { getOverviewMetrics } from '../../roles/ngoManager/controllers/ngoManagerController.js'

describe('NGO manager overview alert count', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        CollectingCenter.countDocuments.mockResolvedValue(0)
        CollectingCenter.find.mockResolvedValue([])
        DistributionOperation.countDocuments.mockResolvedValue(0)
        DistributionOperation.find.mockReturnValue({
            sort: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            select: vi.fn().mockResolvedValue([])
        })
        Volunteer.countDocuments.mockResolvedValue(0)
        Warning.countDocuments.mockResolvedValue(23)
    })

    it('returns the unfiltered system-wide warning count in overview metrics', async () => {
        const res = { json: vi.fn() }

        await getOverviewMetrics({}, res, vi.fn())

        expect(Warning.countDocuments).toHaveBeenCalledWith()
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            metrics: expect.objectContaining({ totalAlerts: 23 })
        }))
    })
})
