import HazardReport from '../../../models/HazardReport.js'
import ReliefDeployment from '../../../models/ReliefDeployment.js'
import ReliefNotification from '../../../models/ReliefNotification.js'

const TEAMS = ['Army', 'Police', 'Fire Brigade']
const STATUSES = ['Pending', 'In Progress', 'Completed']

const reliefLabel = (report) => {
    const type = String(report?.hazardType || 'hazard').replaceAll('_', ' ')
    const district = report?.district ? ` in ${report.district}` : ''
    return `${type}${district}`
}

/**
 * GET /api/ngomanager/relief-deployments
 * All deployments, newest first — feeds DeployBox + counts.
 */
export const listReliefDeployments = async (req, res, next) => {
    try {
        const deployments = await ReliefDeployment.find({})
            .populate('reportId', 'hazardType district status')
            .populate('reporterId', 'name email phone')
            .sort({ createdAt: -1 })
            .lean()
        res.json({ success: true, deployments })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/ngomanager/relief-deployments
 * Assign a team to a verified hazard report + notify the reporting citizen:
 * "🚨 Relief team assigned! The {team} ({teamName}) is on the way for your {hazardType} report..."
 */
export const assignReliefTeam = async (req, res, next) => {
    try {
        const { reportId, team, teamName, dmoContact, notes = '', special = '', urgent = 'Medium' } = req.body || {}
        if (!reportId) return res.status(400).json({ success: false, message: 'reportId is required' })
        if (!TEAMS.includes(team)) return res.status(400).json({ success: false, message: 'team must be Army, Police or Fire Brigade' })
        if (!String(teamName || '').trim()) return res.status(400).json({ success: false, message: 'Team name is required' })
        if (!String(dmoContact || '').trim()) return res.status(400).json({ success: false, message: 'DMO contact is required' })

        const report = await HazardReport.findById(reportId).populate('reporterId', 'name email phone')
        if (!report) return res.status(404).json({ success: false, message: 'Hazard report not found' })

        const risk = String(report?.clusterId?.priorityLevel || 'medium').toLowerCase()
        const deployment = await ReliefDeployment.create({
            reportId: report._id,
            reporterId: report.reporterId?._id || report.reporterId,
            team,
            teamName: String(teamName).trim(),
            dmoContact: String(dmoContact).trim(),
            notes: String(notes || ''),
            special: String(special || ''),
            risk,
            urgent: String(urgent || 'Medium'),
            status: 'In Progress',
            lat: Array.isArray(report?.location?.coordinates) ? report.location.coordinates[1] : null,
            lng: Array.isArray(report?.location?.coordinates) ? report.location.coordinates[0] : null,
            assignedBy: req.user?._id || null
        })

        // Notify the citizen who filed this report
        let notification = null
        if (deployment.reporterId) {
            notification = await ReliefNotification.create({
                recipientId: deployment.reporterId,
                deploymentId: deployment._id,
                reportId: report._id,
                kind: 'relief_assigned',
                title: '🚨 Relief team assigned to your report!',
                message: `Good news ${report.reporterId?.name || ''}! The ${team} team "${deployment.teamName}" is on the way for your ${reliefLabel(report)} report. DMO contact: ${deployment.dmoContact}. Stay safe — help is coming!`,
                severity: 'high',
                hazardType: String(report.hazardType || 'relief')
            })
        }

        res.status(201).json({ success: true, deployment, notification })
    } catch (error) {
        next(error)
    }
}

/**
 * PATCH /api/ngomanager/relief-deployments/:deploymentId
 * Update deployment status. When marked Completed, notify the citizen:
 * "✅ Relief work completed! The {team} ({teamName}) has finished helping with your {hazardType} report. Thank you..."
 */
export const updateReliefStatus = async (req, res, next) => {
    try {
        const { status } = req.body || {}
        if (!STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'status must be Pending, In Progress or Completed' })
        const deployment = await ReliefDeployment.findById(req.params.deploymentId).populate('reportId')
        if (!deployment) return res.status(404).json({ success: false, message: 'Deployment not found' })
        const was = deployment.status
        deployment.status = status
        await deployment.save()

        let notification = null
        if (status === 'Completed' && was !== 'Completed' && deployment.reporterId) {
            notification = await ReliefNotification.create({
                recipientId: deployment.reporterId,
                deploymentId: deployment._id,
                reportId: deployment.reportId?._id || deployment.reportId,
                kind: 'relief_completed',
                title: '✅ Relief work completed!',
                message: `The ${deployment.team} team "${deployment.teamName}" has finished helping with your ${reliefLabel(deployment.reportId)} report. Thank you for reporting — stay safe! If you still need help, please submit a new report.`,
                severity: 'success',
                hazardType: String(deployment.reportId?.hazardType || deployment.risk || 'relief')
            })
        }

        res.json({ success: true, deployment, notification })
    } catch (error) {
        next(error)
    }
}
