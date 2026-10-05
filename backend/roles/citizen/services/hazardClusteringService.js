import ReportCluster from '../../../models/ReportCluster.js'
import HazardReport from '../../../models/HazardReport.js'
import {
    calculateClusterPriority
} from './hazardPriorityService.js'

const CLUSTER_RADIUS_METERS = 2000
const CLUSTER_TIME_WINDOW_HOURS = 6

const getTimeWindowStart = (date) => (
    new Date(
        date.getTime()
        - CLUSTER_TIME_WINDOW_HOURS * 60 * 60 * 1000
    )
)

const calculateClusterCenter = (reports) => {
    const coordinates = reports.map(
        (report) => report.location.coordinates
    )

    const longitude = coordinates.reduce(
        (sum, coordinate) => sum + coordinate[0],
        0
    ) / coordinates.length

    const latitude = coordinates.reduce(
        (sum, coordinate) => sum + coordinate[1],
        0
    ) / coordinates.length

    return {
        type: 'Point',
        coordinates: [longitude, latitude]
    }
}

const findMatchingCluster = async (report) => {
    const reportTime = report.capturedAt
    const timeWindowStart = getTimeWindowStart(reportTime)

    return ReportCluster.findOne({
        hazardType: report.hazardType,
        status: 'active',
        lastReportedAt: {
            $gte: timeWindowStart,
            $lte: reportTime
        },
        center: {
            $near: {
                $geometry: report.location,
                $maxDistance: CLUSTER_RADIUS_METERS
            }
        }
    }).sort({
        lastReportedAt: -1
    })
}

export const assignReportToCluster = async (report) => {
    const existingCluster = await findMatchingCluster(report)

    if (!existingCluster) {
        const cluster = await ReportCluster.create({
            hazardType: report.hazardType,
            reportIds: [report._id],
            center: report.location,
            reportCount: 1,
            firstReportedAt: report.capturedAt,
            lastReportedAt: report.capturedAt,
            status: 'active'
        })

        const priority = calculateClusterPriority(cluster)

        cluster.priorityScore = priority.priorityScore
        cluster.priorityLevel = priority.priorityLevel

        await cluster.save()

        report.clusterId = cluster._id
        await report.save()

        return cluster
    }

    const reports = await HazardReport.find({
        _id: {
            $in: [
                ...existingCluster.reportIds,
                report._id
            ]
        }
    }).select('location capturedAt')

    existingCluster.reportIds.push(report._id)

    existingCluster.reportCount =
        existingCluster.reportIds.length

    existingCluster.center =
        calculateClusterCenter(reports)

    existingCluster.lastReportedAt = new Date(
        Math.max(
            existingCluster.lastReportedAt.getTime(),
            report.capturedAt.getTime()
        )
    )

    const priority = calculateClusterPriority(
        existingCluster
    )

    existingCluster.priorityScore =
        priority.priorityScore

    existingCluster.priorityLevel =
        priority.priorityLevel

    await existingCluster.save()

    report.clusterId = existingCluster._id
    await report.save()

    return existingCluster
}

export default {
    assignReportToCluster
}