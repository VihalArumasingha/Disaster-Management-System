import TargetArea from '../models/TargetArea.js'
import { USER_ROLES } from './constants.js'

export const CITIZEN_ROLE_VALUES = [USER_ROLES.citizen, 'CITIZEN']

export const getCitizenTargetAreaIds = async (location) => {
    if (!location) return []

    const areas = await TargetArea.find({
        geometry: {
            $geoIntersects: {
                $geometry: location
            }
        }
    }).select('_id')

    return areas.map((area) => area._id)
}

export const addCitizenToTargetAreas = async (citizenId, targetAreaIds) => {
    if (targetAreaIds.length === 0) return

    await TargetArea.updateMany(
        { _id: { $in: targetAreaIds } },
        { $addToSet: { citizenIds: citizenId } }
    )
}
