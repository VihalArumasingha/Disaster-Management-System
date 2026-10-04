import AlertNotification from '../../../models/AlertNotification.js'

export const listNotifications = async (req, res, next) => {
    try {
        const notifications = await AlertNotification.find({ recipientId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean()
        res.json({ success: true, notifications })
    } catch (error) {
        next(error)
    }
}

export const markNotificationRead = async (req, res, next) => {
    try {
        const notification = await AlertNotification.findOneAndUpdate(
            { _id: req.params.notificationId, recipientId: req.user._id },
            { $set: { readAt: new Date() } },
            { new: true }
        )
        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            })
        }
        res.json({ success: true, notification })
    } catch (error) {
        next(error)
    }
}
