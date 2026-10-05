import mongoose from 'mongoose'

import HazardReport from '../../../models/HazardReport.js'
import ReportCluster from '../../../models/ReportCluster.js'

import {
    calculateClusterPriority
} from '../../citizen/services/hazardPriorityService.js'

export const getHazardReviewQueue = async () => {
    return ReportCluster.find({
        status: 'active'
    })
        .populate(
            'reportIds',
            'reporterId hazardType description location capturedAt submittedAt status verification'
        )
        .sort({
            priorityScore: -1,
            lastReportedAt: -1
        })
}

export const getHazardReviewCluster = async (
    clusterId
) => {
    if (!mongoose.isValidObjectId(clusterId)) {
        const error = new Error(
            'Invalid hazard cluster ID'
        )

        error.statusCode = 400

        throw error
    }

    return ReportCluster.findById(clusterId)
        .populate(
            'reportIds',
            'reporterId hazardType description location capturedAt submittedAt status verification'
        )
}

const recalculateCluster = async (
    clusterId
) => {
    const cluster = await ReportCluster.findById(
        clusterId
    )

    if (!cluster) {
        return null
    }

    const activeReports = await HazardReport.find({
        _id: {
            $in: cluster.reportIds
        },
        status: {
            $ne: 'rejected'
        }
    }).select(
        'capturedAt'
    )

    cluster.reportCount = activeReports.length

    if (activeReports.length === 0) {
        cluster.priorityScore = 0
        cluster.priorityLevel = 'low'
        cluster.status = 'closed'

        await cluster.save()

        return cluster
    }

    cluster.lastReportedAt = activeReports.reduce(
        (latest, report) => (
            report.capturedAt > latest
                ? report.capturedAt
                : latest
        ),
        activeReports[0].capturedAt
    )

    const priority = calculateClusterPriority(
        cluster
    )

    cluster.priorityScore = priority.priorityScore
    cluster.priorityLevel = priority.priorityLevel

    await cluster.save()

    return cluster
}

export const verifyHazardReport = async (
    reportId,
    officerId
) => {
    const report = await HazardReport.findById(
        reportId
    )

    if (!report) {
        return null
    }

    if (report.status !== 'pending') {
        const error = new Error(
            'Only pending hazard reports can be verified'
        )

        error.statusCode = 400

        throw error
    }

    report.status = 'verified'

    report.verification = {
        verifiedBy: officerId,
        verifiedAt: new Date()
    }

    await report.save()

    const cluster = await recalculateCluster(
        report.clusterId
    )

    return {
        report,
        cluster
    }
}

export const rejectHazardReport = async (
    reportId,
    officerId,
    reason
) => {
    const report = await HazardReport.findById(
        reportId
    )

    if (!report) {
        return null
    }

    if (report.status !== 'pending') {
        const error = new Error(
            'Only pending hazard reports can be rejected'
        )

        error.statusCode = 400

        throw error
    }

    report.status = 'rejected'

    report.verification = {
        verifiedBy: officerId,
        verifiedAt: new Date(),
        rejectionReason: reason.trim()
    }

    await report.save()

    const cluster = await recalculateCluster(
        report.clusterId
    )

    return {
        report,
        cluster
    }
}

export default {
    getHazardReviewQueue,
    getHazardReviewCluster,
    verifyHazardReport,
    rejectHazardReport
}