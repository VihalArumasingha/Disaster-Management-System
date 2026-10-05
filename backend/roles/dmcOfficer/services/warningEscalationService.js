export const prepareEscalationHandoff = async (
    context = {}
) => ({
    ready: true,

    source: 'hazard report review',

    target: 'warning workflow',

    status: 'pending implementation',

    boundary: {
        createsWarnings: false,
        calculatesThresholds: false,
        sendsNotifications: false,
        performsDutyOfficerWorkflow: false
    },

    context
})

export default {
    prepareEscalationHandoff
}