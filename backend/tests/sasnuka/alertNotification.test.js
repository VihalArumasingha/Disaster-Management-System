import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'

// Mock database models and HTTP calls. No real database, SMS, or email is used.
vi.mock('axios', () => ({
    default: { post: vi.fn(), get: vi.fn() }
}))

vi.mock('../../models/AlertNotification.js', () => ({
    default: { find: vi.fn(), findOneAndUpdate: vi.fn() }
}))

vi.mock('../../models/User.js', () => ({
    default: { findOne: vi.fn() }
}))

vi.mock('../../models/Warning.js', () => ({
    default: {
        find: vi.fn(),
        findOne: vi.fn(),
        findById: vi.fn(),
        updateOne: vi.fn()
    }
}))

vi.mock('../../models/WarningDelivery.js', () => ({
    default: {
        findOneAndUpdate: vi.fn(),
        findOne: vi.fn(),
        find: vi.fn(),
        updateOne: vi.fn(),
        updateMany: vi.fn()
    }
}))

vi.mock('../../models/TextBeeWebhookEvent.js', () => ({
    default: {
        create: vi.fn(),
        findOne: vi.fn(),
        findOneAndUpdate: vi.fn(),
        updateOne: vi.fn(),
        updateMany: vi.fn(),
        find: vi.fn()
    }
}))

vi.mock('../../utils/citizenTargetAreas.js', () => ({
    CITIZEN_ROLE_VALUES: ['citizen', 'CITIZEN']
}))

vi.mock('../../roles/citizen/services/nearbyHazardService.js', () => ({
    getNearbyHazards: vi.fn(),
    getNearbyFacilities: vi.fn()
}))

import axios from 'axios'
import AlertNotification from '../../models/AlertNotification.js'
import User from '../../models/User.js'
import Warning from '../../models/Warning.js'
import WarningDelivery from '../../models/WarningDelivery.js'
import TextBeeWebhookEvent from '../../models/TextBeeWebhookEvent.js'

import {
    deliverWarningToCitizen,
    refreshWarningDeliverySummary,
    finalizeWarningDelivery,
    processTextBeeWebhookEvent,
    enqueueTextBeeWebhookEvent,
    processPendingTextBeeWebhookEvents,
    pollQueuedTextBeeDeliveries,
    verifyTextBeeWebhookSignature
} from '../../roles/dmcOfficer/services/warningDeliveryService.js'

import {
    getNearbyHazards,
    getNearbyFacilities
} from '../../roles/citizen/services/nearbyHazardService.js'

import {
    listNotifications,
    listRecentWarnings,
    getLatestCitizenWarning,
    nearbyHazards,
    nearbyFacilities,
    getWarningDetail,
    markNotificationRead
} from '../../roles/citizen/controllers/notificationController.js'

const WARNING_ID = '64a000000000000000000030'
const CITIZEN_ID = '64a000000000000000000020'

// Provides reusable mock notification delivery data.
const makeDelivery = (overrides = {}) => ({
    _id: 'delivery-1',
    warningId: WARNING_ID,
    recipientId: CITIZEN_ID,
    inApp: { status: 'pending', error: '' },
    sms: {
        status: 'pending',
        error: '',
        providerBatchId: '',
        lastPolledAt: null
    },
    email: { status: 'pending', error: '' },
    ...overrides
})

// Updates nested mock fields in the in-memory delivery object.
const setNested = (object, path, value) => {
    const keys = path.split('.')
    const lastKey = keys.pop()
    let current = object

    for (const key of keys) {
        current = current[key] ||= {}
    }

    current[lastKey] = value
}

// Simulates model updates without connecting to MongoDB.
const useDeliveryStore = (initialDelivery) => {
    const state = structuredClone(initialDelivery)

    WarningDelivery.findOneAndUpdate.mockImplementation(
        async (_filter, update) => {
            for (const [path, value] of Object.entries(
                update.$setOnInsert || {}
            )) {
                if (state[path] === undefined) {
                    state[path] = value
                }
            }

            for (const [path, value] of Object.entries(update.$set || {})) {
                setNested(state, path, value)
            }

            return state
        }
    )

    return state
}

// Simulates the Mongoose query chaining used by services and controllers.
const queryReturning = (value) => {
    const query = {
        select: vi.fn(() => query),
        populate: vi.fn(() => query),
        sort: vi.fn(() => query),
        limit: vi.fn(() => query),
        lean: vi.fn(() => query),
        then: (resolve, reject) => Promise.resolve(value).then(resolve, reject)
    }

    return query
}

// Configures a queued delivery and mocked TextBee status response.
const configurePolling = ({
    currentStatus = 'queued',
    providerMessage,
    recipient = { _id: CITIZEN_ID }
}) => {
    const delivery = makeDelivery({
        sms: {
            status: currentStatus,
            providerBatchId: 'batch-poll',
            lastPolledAt: null,
            error: ''
        }
    })

    const message = {
        smsBatchId: 'batch-poll',
        ...providerMessage
    }

    const providerStatus = String(
        message.status || message.state || ''
    ).toLowerCase()

    const nextStatus = providerStatus === 'pending'
        ? 'queued'
        : providerStatus || 'unknown'

    const updatedDelivery = makeDelivery({
        ...delivery,
        sms: {
            ...delivery.sms,
            status: nextStatus,
            ...message
        }
    })

    WarningDelivery.find
        .mockReturnValueOnce(queryReturning([delivery]))
        .mockResolvedValueOnce([updatedDelivery])

    WarningDelivery.findOneAndUpdate
        .mockResolvedValueOnce(delivery)
        .mockResolvedValueOnce(updatedDelivery)

    User.findOne.mockReturnValue(queryReturning(recipient))
    axios.get.mockResolvedValue({ data: { data: [message] } })
    Warning.findById.mockResolvedValue(makeWarning())

    return { delivery, updatedDelivery }
}

// Prepares a mocked failed SMS event to test email fallback.
const configureFailedWebhook = ({
    warning = makeWarning(),
    recipient = {
        _id: CITIZEN_ID,
        name: 'Mock Citizen',
        email: 'citizen@example.test'
    },
    claimEmailFallback = true
} = {}) => {
    const failedDelivery = makeDelivery({
        sms: {
            status: 'failed',
            providerBatchId: 'batch-failed',
            error: 'provider failure'
        }
    })

    TextBeeWebhookEvent.findOneAndUpdate.mockResolvedValue({
        _id: 'event-failed-sms',
        attempts: 1,
        payload: {
            webhookEvent: 'MESSAGE_FAILED',
            smsBatchId: 'batch-failed'
        }
    })

    WarningDelivery.findOne.mockResolvedValue(makeDelivery({
        sms: {
            status: 'queued',
            providerBatchId: 'batch-failed',
            error: ''
        }
    }))

    WarningDelivery.findOneAndUpdate
        .mockResolvedValueOnce(failedDelivery)
        .mockResolvedValueOnce(claimEmailFallback ? failedDelivery : null)

    Warning.findById.mockResolvedValue(warning)
    User.findOne.mockReturnValue(queryReturning(recipient))
    WarningDelivery.find.mockResolvedValue([failedDelivery])

    return failedDelivery
}

const makeWarning = (overrides = {}) => ({
    _id: WARNING_ID,
    title: 'Flood Warning',
    severity: 'warning',
    hazardType: 'flood',
    message: 'Move to higher ground',
    updates: [],
    status: 'issuing',
    issuedAt: new Date('2026-10-09T08:00:00Z'),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides
})

describe('Alert notification and delivery unit tests', () => {
    beforeEach(() => {
        vi.resetAllMocks()

        vi.stubEnv('TEXTBEE_API_KEY', '')
        vi.stubEnv('TEXTBEE_BASE_URL', 'https://api.textbee.dev/api/v1')
        vi.stubEnv('TEXTBEE_WEBHOOK_SECRET', '')
        vi.stubEnv('BREVO_API_KEY', '')
        vi.stubEnv('BREVO_SENDER_EMAIL', '')
        vi.stubEnv('BREVO_SENDER_NAME', '')
    })

    afterEach(() => {
        vi.unstubAllEnvs()
    })

    // ========================================================
    // ALERT DELIVERY
    // ========================================================

    describe('Deliver an alert to one citizen', () => {

        // POSITIVE: saves an in-app notification and queues an SMS.
        it('creates an in-app notification and queues an SMS', async () => {
            const delivery = useDeliveryStore(makeDelivery())
            AlertNotification.findOneAndUpdate.mockResolvedValue({})
            vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')

            axios.post.mockResolvedValue({
                data: {
                    success: true,
                    smsBatchId: 'batch-001'
                }
            })

            const result = await deliverWarningToCitizen({
                _id: WARNING_ID,
                title: 'Flood Warning',
                message: 'Move now',
                severity: 'warning',
                hazardType: 'flood'
            }, {
                _id: CITIZEN_ID,
                name: 'Mock Citizen',
                phone: '0712345678'
            })

            expect(AlertNotification.findOneAndUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    warningId: WARNING_ID,
                    recipientId: CITIZEN_ID
                }),
                expect.objectContaining({
                    $setOnInsert: expect.objectContaining({
                        title: 'Flood Warning'
                    })
                }),
                expect.any(Object)
            )

            expect(axios.post).toHaveBeenCalledWith(
                'https://api.textbee.dev/api/v1/gateway/send-sms',
                expect.objectContaining({
                    recipients: ['+94712345678']
                }),
                expect.any(Object)
            )

            expect(result.inApp.status).toBe('sent')
            expect(result.sms.status).toBe('queued')
            expect(result.email.status).toBe('not_required')
            expect(delivery).toBe(result)
        })

        // ERROR/FALLBACK: email is attempted if saving the in-app alert fails.
        it('attempts email fallback when in-app delivery fails', async () => {
            useDeliveryStore(makeDelivery())

            AlertNotification.findOneAndUpdate.mockRejectedValue(
                new Error('mock alert save failed')
            )

            vi.stubEnv('BREVO_API_KEY', 'test-brevo-key')
            vi.stubEnv('BREVO_SENDER_EMAIL', 'noreply@example.test')

            axios.post.mockResolvedValue({
                data: { messageId: 'email-message-001' }
            })

            const result = await deliverWarningToCitizen({
                _id: WARNING_ID,
                title: 'Flood Warning',
                message: 'Move now',
                severity: 'warning',
                hazardType: 'flood'
            }, {
                _id: CITIZEN_ID,
                name: 'Mock Citizen',
                email: 'citizen@example.test'
            })

            expect(result.inApp.status).toBe('failed')
            expect(result.sms.status).toBe('failed')
            expect(result.email.status).toBe('sent')

            expect(axios.post).toHaveBeenCalledWith(
                'https://api.brevo.com/v3/smtp/email',
                expect.objectContaining({
                    to: [{
                        email: 'citizen@example.test',
                        name: 'Mock Citizen'
                    }]
                }),
                expect.any(Object)
            )
        })

        // EDGE: previously delivered channels must not be sent again.
        it('does not resend channels already sent or delivered', async () => {
            const existing = makeDelivery({
                inApp: { status: 'sent', error: '' },
                sms: { status: 'delivered', error: '' },
                email: { status: 'pending', error: '' }
            })

            useDeliveryStore(existing)

            const result = await deliverWarningToCitizen({
                _id: WARNING_ID,
                title: 'Flood Warning',
                message: 'Move now',
                severity: 'warning',
                hazardType: 'flood'
            }, {
                _id: CITIZEN_ID,
                phone: '0712345678'
            })

            expect(AlertNotification.findOneAndUpdate).not.toHaveBeenCalled()
            expect(axios.post).not.toHaveBeenCalled()
            expect(result.inApp.status).toBe('sent')
            expect(result.sms.status).toBe('delivered')
            expect(result.email.status).toBe('not_required')
        })

        // NEGATIVE: invalid phone numbers must not reach TextBee.
        it('records an invalid recipient phone without calling TextBee', async () => {
            useDeliveryStore(makeDelivery())
            vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')

            const result = await deliverWarningToCitizen({
                _id: WARNING_ID,
                title: 'Flood Warning',
                message: 'Move now',
                severity: 'warning',
                hazardType: 'flood'
            }, {
                _id: CITIZEN_ID,
                phone: 'not-a-phone'
            })

            expect(axios.post).not.toHaveBeenCalled()
            expect(result.sms).toMatchObject({
                status: 'failed',
                error: 'Citizen phone number is not a valid international number'
            })
        })

        // EDGE: a successful provider response without a batch ID triggers fallback.
        it('uses email fallback when TextBee omits its SMS batch ID', async () => {
            useDeliveryStore(makeDelivery())

            vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')
            vi.stubEnv('BREVO_API_KEY', 'test-brevo-key')
            vi.stubEnv('BREVO_SENDER_EMAIL', 'noreply@example.test')

            axios.post
                .mockResolvedValueOnce({ data: { success: true } })
                .mockResolvedValueOnce({ data: { messageId: 'email-fallback-1' } })

            const result = await deliverWarningToCitizen({
                _id: WARNING_ID,
                title: 'Flood Warning',
                message: 'Move now',
                severity: 'warning',
                hazardType: 'flood'
            }, {
                _id: CITIZEN_ID,
                phone: '0712345678',
                email: 'citizen@example.test'
            })

            expect(result.sms.status).toBe('failed')
            expect(result.sms.error).toContain('did not return a batch ID')
            expect(result.email.status).toBe('sent')
            expect(axios.post).toHaveBeenCalledTimes(2)
        })

        // ERROR: missing contact details are recorded per channel.
        it('records missing phone and email contact details', async () => {
            useDeliveryStore(makeDelivery())

            const result = await deliverWarningToCitizen({
                _id: WARNING_ID,
                title: 'Flood Warning',
                message: 'Move now',
                severity: 'warning',
                hazardType: 'flood'
            }, {
                _id: CITIZEN_ID
            })

            expect(result.sms).toMatchObject({
                status: 'failed',
                error: 'Citizen has no phone number'
            })

            expect(result.email).toMatchObject({
                status: 'failed',
                error: 'Citizen has no email address'
            })

            expect(axios.post).not.toHaveBeenCalled()
        })

        // ERROR: API keys must be redacted from provider error messages.
        it('redacts the TextBee API key from a rejected-provider error', async () => {
            useDeliveryStore(makeDelivery())
            vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')

            axios.post.mockResolvedValue({
                data: {
                    success: false,
                    error: 'request rejected with test-textbee-key'
                }
            })

            const result = await deliverWarningToCitizen({
                _id: WARNING_ID,
                title: 'Flood Warning',
                message: 'Move now',
                severity: 'warning',
                hazardType: 'flood'
            }, {
                _id: CITIZEN_ID,
                phone: '0712345678'
            })

            expect(result.sms.status).toBe('failed')
            expect(result.sms.error).toContain('[redacted]')
            expect(result.sms.error).not.toContain('test-textbee-key')
        })

        // POSITIVE: Brevo may omit optional response metadata.
        it('uses the default email sender name and handles no message ID', async () => {
            useDeliveryStore(makeDelivery())

            AlertNotification.findOneAndUpdate.mockRejectedValue(
                new Error('in-app persistence failed')
            )

            vi.stubEnv('BREVO_API_KEY', 'test-brevo-key')
            vi.stubEnv('BREVO_SENDER_EMAIL', 'noreply@example.test')

            axios.post.mockResolvedValue({ data: {} })

            const result = await deliverWarningToCitizen({
                _id: WARNING_ID,
                title: 'Flood Warning',
                message: 'Move now',
                severity: 'warning',
                hazardType: 'flood'
            }, {
                _id: CITIZEN_ID,
                email: 'citizen@example.test'
            })

            expect(axios.post).toHaveBeenCalledWith(
                'https://api.brevo.com/v3/smtp/email',
                expect.objectContaining({
                    sender: {
                        email: 'noreply@example.test',
                        name: 'Disaster Management System'
                    }
                }),
                expect.any(Object)
            )

            expect(result.email).toMatchObject({
                status: 'sent',
                providerMessageId: ''
            })
        })
    })

    // ========================================================
    // DELIVERY SUMMARY
    // ========================================================

    describe('Delivery summary', () => {

        // POSITIVE: summarizes channel states and groups failure reasons.
        it('summarizes channel states and failed recipients', async () => {
            Warning.findById.mockResolvedValue(makeWarning())

            WarningDelivery.find.mockResolvedValue([
                makeDelivery({
                    inApp: { status: 'sent', error: '' },
                    sms: { status: 'queued', error: '' },
                    email: { status: 'not_required', error: '' }
                }),
                makeDelivery({
                    _id: 'delivery-2',
                    inApp: { status: 'failed', error: 'storage error' },
                    sms: { status: 'failed', error: 'no phone' },
                    email: { status: 'failed', error: 'no email' }
                }),
                makeDelivery({
                    _id: 'delivery-3',
                    inApp: { status: 'failed', error: 'storage error' },
                    sms: { status: 'sent', error: '' },
                    email: { status: 'not_required', error: '' }
                })
            ])

            const summary = await refreshWarningDeliverySummary(WARNING_ID)

            expect(summary.recipients).toBe(3)
            expect(summary.inAppSent).toBe(1)
            expect(summary.smsQueued).toBe(1)
            expect(summary.smsSent).toBe(1)
            expect(summary.smsFailed).toBe(1)
            expect(summary.failedRecipients).toBe(1)

            expect(summary.failureDetails).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    channel: 'inApp',
                    reason: 'storage error',
                    count: 2
                })
            ]))

            expect(Warning.updateOne).toHaveBeenCalledWith(
                { _id: WARNING_ID },
                { $set: { deliverySummary: summary } }
            )
        })

        // EDGE: no warning means there is no summary to update.
        it('returns undefined when the warning does not exist', async () => {
            Warning.findById.mockResolvedValue(null)
            WarningDelivery.find.mockResolvedValue([])

            await expect(
                refreshWarningDeliverySummary(WARNING_ID)
            ).resolves.toBeUndefined()

            expect(Warning.updateOne).not.toHaveBeenCalled()
        })

        // POSITIVE: partial success produces partially_issued status.
        it('finalizes a warning as partially issued when some recipients fail', async () => {
            const warning = makeWarning({ updates: [] })

            const deliveries = [
                makeDelivery({
                    inApp: { status: 'sent', error: '' },
                    sms: { status: 'queued', error: '' },
                    email: { status: 'not_required', error: '' }
                }),
                makeDelivery({
                    _id: 'delivery-2',
                    inApp: { status: 'failed', error: 'save error' },
                    sms: { status: 'failed', error: 'sms error' },
                    email: { status: 'failed', error: 'email error' }
                })
            ]

            Warning.findById.mockResolvedValue(warning)
            WarningDelivery.find.mockResolvedValue(deliveries)

            await finalizeWarningDelivery(WARNING_ID)

            expect(warning.status).toBe('partially_issued')
            expect(warning.issuedAt).toBeInstanceOf(Date)
            expect(warning.updates).toContainEqual(
                expect.objectContaining({ type: 'issued' })
            )
            expect(warning.save).toHaveBeenCalled()
        })

        // POSITIVE: fully delivered warnings do not duplicate an existing issued update.
        it('finalizes delivered warnings as issued without duplicating the update', async () => {
            const warning = makeWarning({
                updates: [{ type: 'issued', title: 'Already recorded' }],
                issuedAt: new Date('2026-10-09T08:00:00Z')
            })

            Warning.findById.mockResolvedValue(warning)

            WarningDelivery.find.mockResolvedValue([
                makeDelivery({
                    inApp: { status: 'sent', error: '' },
                    sms: { status: 'delivered', error: '' },
                    email: { status: 'not_required', error: '' }
                })
            ])

            await finalizeWarningDelivery(WARNING_ID)

            expect(warning.status).toBe('issued')
            expect(warning.updates).toHaveLength(1)
            expect(warning.save).toHaveBeenCalledOnce()
        })

        // NEGATIVE: no successful channels result in delivery_failed.
        it('finalizes fully failed delivery attempts as delivery_failed', async () => {
            const warning = makeWarning({ updates: [] })

            Warning.findById.mockResolvedValue(warning)

            WarningDelivery.find.mockResolvedValue([
                makeDelivery({
                    inApp: { status: 'failed', error: '' },
                    sms: { status: 'failed', error: '' },
                    email: { status: 'failed', error: '' }
                })
            ])

            await finalizeWarningDelivery(WARNING_ID)

            expect(warning.status).toBe('delivery_failed')
            expect(warning.updates).toContainEqual(
                expect.objectContaining({ type: 'issued' })
            )
        })
    })

    // ========================================================
    // TEXTBEE WEBHOOK QUEUE
    // ========================================================

    describe('TextBee webhook queue', () => {

        // POSITIVE: a valid HMAC signature is accepted.
        it('accepts a valid webhook signature', () => {
            vi.stubEnv('TEXTBEE_WEBHOOK_SECRET', 'test-signing-secret')

            const body = Buffer.from('{"event":"MESSAGE_SENT"}')
            const signature = createHmac(
                'sha256',
                'test-signing-secret'
            ).update(body).digest('hex')

            expect(verifyTextBeeWebhookSignature(body, signature)).toBe(true)
        })

        // NEGATIVE/EDGE: missing secrets and invalid signatures are rejected.
        it('rejects invalid or missing webhook signatures', () => {
            const body = Buffer.from('message')

            expect(
                verifyTextBeeWebhookSignature(body, 'not-a-signature')
            ).toBe(false)

            expect(
                verifyTextBeeWebhookSignature('not-a-buffer', 'abc')
            ).toBe(false)

            vi.stubEnv('TEXTBEE_WEBHOOK_SECRET', 'test-secret')

            const valid = createHmac('sha256', 'test-secret')
                .update(body)
                .digest('hex')

            expect(
                verifyTextBeeWebhookSignature(Buffer.from('changed'), valid)
            ).toBe(false)
        })

        // POSITIVE: a new webhook is saved with its idempotency key.
        it('enqueues a webhook event', async () => {
            const payload = {
                idempotencyKey: 'evt-1',
                webhookEvent: 'MESSAGE_SENT',
                smsBatchId: 'batch-1',
                status: 'sent'
            }

            TextBeeWebhookEvent.create.mockResolvedValue({
                _id: 'event-1',
                idempotencyKey: 'evt-1'
            })

            const result = await enqueueTextBeeWebhookEvent(payload)

            expect(TextBeeWebhookEvent.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    idempotencyKey: 'evt-1',
                    payload: expect.objectContaining({
                        webhookEvent: 'MESSAGE_SENT',
                        smsBatchId: 'batch-1'
                    })
                })
            )

            expect(result._id).toBe('event-1')
        })

        // EDGE: duplicate webhook keys return the previously stored event.
        it('returns the existing event when an idempotency key is duplicated', async () => {
            const existing = {
                _id: 'event-existing',
                idempotencyKey: 'evt-1'
            }

            const duplicateError = new Error('duplicate key')
            duplicateError.code = 11000

            TextBeeWebhookEvent.create.mockRejectedValue(duplicateError)
            TextBeeWebhookEvent.findOne.mockResolvedValue(existing)

            await expect(enqueueTextBeeWebhookEvent({
                idempotencyKey: 'evt-1',
                webhookEvent: 'MESSAGE_SENT'
            })).resolves.toBe(existing)
        })

        // ERROR: non-duplicate database failures are propagated.
        it('propagates unexpected enqueue errors', async () => {
            TextBeeWebhookEvent.create.mockRejectedValue(
                new Error('database unavailable')
            )

            await expect(
                enqueueTextBeeWebhookEvent({ idempotencyKey: 'evt-2' })
            ).rejects.toThrow('database unavailable')
        })

        // EDGE: an event that is no longer pending is not processed twice.
        it('does nothing when no pending webhook event can be claimed', async () => {
            TextBeeWebhookEvent.findOneAndUpdate.mockResolvedValue(null)

            await processTextBeeWebhookEvent('missing-event')

            expect(TextBeeWebhookEvent.updateOne).not.toHaveBeenCalled()
        })

        // POSITIVE: unsupported events are marked processed without changing deliveries.
        it('marks an unsupported webhook event as processed', async () => {
            TextBeeWebhookEvent.findOneAndUpdate.mockResolvedValue({
                _id: 'event-3',
                attempts: 1,
                payload: { webhookEvent: 'UNSUPPORTED_EVENT' }
            })

            await processTextBeeWebhookEvent('event-3')

            expect(TextBeeWebhookEvent.updateOne).toHaveBeenCalledWith(
                { _id: 'event-3', status: 'processing' },
                {
                    $set: expect.objectContaining({
                        status: 'processed',
                        lastError: ''
                    })
                }
            )

            expect(WarningDelivery.findOne).not.toHaveBeenCalled()
        })

        // ERROR: events without an SMS batch ID are queued for retry.
        it('requeues a webhook event missing its SMS batch ID', async () => {
            TextBeeWebhookEvent.findOneAndUpdate.mockResolvedValue({
                _id: 'event-4',
                attempts: 1,
                payload: { webhookEvent: 'MESSAGE_SENT' }
            })

            await processTextBeeWebhookEvent('event-4')

            expect(TextBeeWebhookEvent.updateOne).toHaveBeenCalledWith(
                { _id: 'event-4', status: 'processing' },
                {
                    $set: expect.objectContaining({
                        status: 'pending',
                        lastError: expect.stringContaining('batch ID')
                    })
                }
            )
        })

        // POSITIVE: MESSAGE_SENT updates a queued SMS delivery.
        it('updates a queued SMS when TextBee reports it sent', async () => {
            const updatedDelivery = makeDelivery({
                sms: { status: 'sent', error: '' }
            })

            TextBeeWebhookEvent.findOneAndUpdate.mockResolvedValue({
                _id: 'event-5',
                attempts: 1,
                payload: {
                    webhookEvent: 'MESSAGE_SENT',
                    smsBatchId: 'batch-1'
                }
            })

            WarningDelivery.findOne.mockResolvedValue(makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-1'
                }
            }))

            WarningDelivery.findOneAndUpdate.mockResolvedValue(updatedDelivery)
            Warning.findById.mockResolvedValue(makeWarning())
            WarningDelivery.find.mockResolvedValue([updatedDelivery])

            await processTextBeeWebhookEvent('event-5')

            expect(WarningDelivery.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: 'delivery-1' },
                {
                    $set: expect.objectContaining({
                        'sms.status': 'sent'
                    })
                },
                { new: true }
            )

            expect(TextBeeWebhookEvent.updateOne).toHaveBeenCalledWith(
                { _id: 'event-5', status: 'processing' },
                { $set: expect.objectContaining({ status: 'processed' }) }
            )
        })

        // POSITIVE: delivery-status webhooks transition the stored SMS state.
        it.each([
            ['MESSAGE_DELIVERED', 'delivered'],
            ['UNKNOWN_STATE', 'unknown']
        ])('applies a %s event as %s', async (webhookEvent, expectedStatus) => {
            const eventId = 'event-status-update'

            const updatedDelivery = makeDelivery({
                sms: {
                    status: expectedStatus,
                    providerBatchId: 'batch-1',
                    error: ''
                }
            })

            TextBeeWebhookEvent.findOneAndUpdate.mockResolvedValue({
                _id: eventId,
                attempts: 1,
                payload: {
                    webhookEvent,
                    smsBatchId: 'batch-1',
                    status: 'unclassified'
                }
            })

            WarningDelivery.findOne.mockResolvedValue(makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-1',
                    error: ''
                }
            }))

            WarningDelivery.findOneAndUpdate.mockResolvedValue(updatedDelivery)
            Warning.findById.mockResolvedValue(makeWarning())
            WarningDelivery.find.mockResolvedValue([updatedDelivery])

            await processTextBeeWebhookEvent(eventId)

            expect(WarningDelivery.findOneAndUpdate).toHaveBeenCalledWith(
                { _id: 'delivery-1' },
                {
                    $set: expect.objectContaining({
                        'sms.status': expectedStatus
                    })
                },
                { new: true }
            )
        })

        // NEGATIVE: a missing delivery is retried rather than discarded.
        it('requeues an event until its delivery record exists', async () => {
            TextBeeWebhookEvent.findOneAndUpdate.mockResolvedValue({
                _id: 'event-missing-delivery',
                attempts: 2,
                payload: {
                    webhookEvent: 'MESSAGE_DELIVERED',
                    smsBatchId: 'batch-missing'
                }
            })

            WarningDelivery.findOne.mockResolvedValue(null)

            await processTextBeeWebhookEvent('event-missing-delivery')

            expect(TextBeeWebhookEvent.updateOne).toHaveBeenCalledWith(
                { _id: 'event-missing-delivery', status: 'processing' },
                {
                    $set: expect.objectContaining({
                        status: 'pending',
                        lastError: expect.stringContaining('No warning delivery matches')
                    })
                }
            )
        })

        // EDGE: a late failure cannot downgrade an already delivered SMS.
        it('does not downgrade delivered SMS after a late failure event', async () => {
            TextBeeWebhookEvent.findOneAndUpdate.mockResolvedValue({
                _id: 'event-late-failure',
                attempts: 1,
                payload: {
                    webhookEvent: 'MESSAGE_FAILED',
                    smsBatchId: 'batch-1'
                }
            })

            WarningDelivery.findOne.mockResolvedValue(makeDelivery({
                sms: {
                    status: 'delivered',
                    providerBatchId: 'batch-1',
                    error: ''
                }
            }))

            await processTextBeeWebhookEvent('event-late-failure')

            expect(WarningDelivery.findOneAndUpdate).not.toHaveBeenCalled()
            expect(WarningDelivery.updateOne).not.toHaveBeenCalled()

            expect(TextBeeWebhookEvent.updateOne).toHaveBeenCalledWith(
                { _id: 'event-late-failure', status: 'processing' },
                { $set: expect.objectContaining({ status: 'processed' }) }
            )
        })

        // ERROR: SMS failure is recorded even when the email fallback is already claimed.
        it('records an SMS failure when the email fallback is already claimed', async () => {
            const updatedDelivery = makeDelivery({
                sms: {
                    status: 'failed',
                    providerBatchId: 'batch-1',
                    error: 'provider failed'
                }
            })

            TextBeeWebhookEvent.findOneAndUpdate.mockResolvedValue({
                _id: 'event-failed',
                attempts: 1,
                payload: {
                    webhookEvent: 'MESSAGE_FAILED',
                    smsBatchId: 'batch-1',
                    errorCode: 'NO_ROUTE',
                    errorMessage: 'No route'
                }
            })

            WarningDelivery.findOne.mockResolvedValue(makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-1',
                    error: ''
                }
            }))

            WarningDelivery.findOneAndUpdate
                .mockResolvedValueOnce(updatedDelivery)
                .mockResolvedValueOnce(null)

            Warning.findById.mockResolvedValue(makeWarning())
            WarningDelivery.find.mockResolvedValue([updatedDelivery])

            await processTextBeeWebhookEvent('event-failed')

            expect(WarningDelivery.findOneAndUpdate).toHaveBeenNthCalledWith(
                1,
                { _id: 'delivery-1' },
                {
                    $set: expect.objectContaining({
                        'sms.status': 'failed',
                        'sms.error': 'Code NO_ROUTE: No route'
                    })
                },
                { new: true }
            )

            expect(WarningDelivery.findOneAndUpdate).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    'email.status': { $in: ['pending', 'not_required', 'failed'] }
                }),
                expect.any(Object),
                { new: true }
            )
        })

        // POSITIVE: failed SMS triggers an email fallback.
        it('sends and records the email fallback after an SMS failure', async () => {
            const delivery = configureFailedWebhook()

            vi.stubEnv('BREVO_API_KEY', 'test-brevo-key')
            vi.stubEnv('BREVO_SENDER_EMAIL', 'noreply@example.test')

            axios.post.mockResolvedValue({
                data: { messageId: 'fallback-message-1' }
            })

            await processTextBeeWebhookEvent('event-failed-sms')

            expect(WarningDelivery.updateOne).toHaveBeenCalledWith(
                { _id: delivery._id },
                {
                    $set: expect.objectContaining({
                        'email.status': 'sent',
                        'email.providerMessageId': 'fallback-message-1'
                    })
                }
            )
        })

        // NEGATIVE: a citizen without an email address receives a fallback failure status.
        it('records fallback failure when the recipient has no email address', async () => {
            const delivery = configureFailedWebhook({
                recipient: { _id: CITIZEN_ID, name: 'Mock Citizen' }
            })

            await processTextBeeWebhookEvent('event-failed-sms')

            expect(WarningDelivery.updateOne).toHaveBeenCalledWith(
                { _id: delivery._id },
                {
                    $set: {
                        'email.status': 'failed',
                        'email.error': 'Citizen has no email address'
                    }
                }
            )
        })

        // ERROR: email-provider failures are recorded in the delivery.
        it('records an email-provider error after a failed SMS', async () => {
            const delivery = configureFailedWebhook()

            vi.stubEnv('BREVO_API_KEY', 'test-brevo-key')
            vi.stubEnv('BREVO_SENDER_EMAIL', 'noreply@example.test')

            axios.post.mockRejectedValue(
                new Error('Brevo temporarily unavailable')
            )

            await processTextBeeWebhookEvent('event-failed-sms')

            expect(WarningDelivery.updateOne).toHaveBeenCalledWith(
                { _id: delivery._id },
                {
                    $set: {
                        'email.status': 'failed',
                        'email.error': 'Brevo temporarily unavailable'
                    }
                }
            )
        })

        // EDGE: fallback fails if the recipient account is no longer eligible.
        it('marks fallback failed when the recipient account no longer exists', async () => {
            const delivery = configureFailedWebhook({ recipient: null })

            await processTextBeeWebhookEvent('event-failed-sms')

            expect(WarningDelivery.updateOne).toHaveBeenCalledWith(
                { _id: delivery._id },
                {
                    $set: {
                        'email.status': 'failed',
                        'email.error': 'Citizen account is no longer eligible'
                    }
                }
            )
        })
    })

    // ========================================================
    // QUEUED SMS POLLING
    // ========================================================

    describe('Queued SMS polling', () => {

        // EDGE: polling is skipped if TextBee is not configured.
        it('does not query deliveries without an API key', async () => {
            await pollQueuedTextBeeDeliveries()

            expect(WarningDelivery.find).not.toHaveBeenCalled()
        })

        // POSITIVE: a provider-delivered status is persisted.
        it('updates a queued delivery when the provider reports delivered', async () => {
            vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')

            const existing = makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-1',
                    lastPolledAt: null,
                    error: ''
                }
            })

            const updated = makeDelivery({
                sms: {
                    status: 'delivered',
                    providerBatchId: 'batch-1',
                    lastPolledAt: new Date(),
                    error: ''
                }
            })

            WarningDelivery.find
                .mockReturnValueOnce(queryReturning([existing]))
                .mockResolvedValueOnce([updated])

            WarningDelivery.findOneAndUpdate
                .mockResolvedValueOnce(existing)
                .mockResolvedValueOnce(updated)

            User.findOne.mockReturnValue(queryReturning({ _id: CITIZEN_ID }))

            axios.get.mockResolvedValue({
                data: {
                    data: [{
                        smsBatchId: 'batch-1',
                        status: 'delivered',
                        deliveredAt: '2026-10-09T09:00:00Z'
                    }]
                }
            })

            Warning.findById.mockResolvedValue(makeWarning())

            await pollQueuedTextBeeDeliveries()

            expect(axios.get).toHaveBeenCalledWith(
                'https://api.textbee.dev/api/v1/gateway/messages',
                expect.objectContaining({
                    params: expect.objectContaining({
                        smsBatchId: 'batch-1'
                    })
                })
            )

            expect(WarningDelivery.findOneAndUpdate).toHaveBeenLastCalledWith(
                {
                    _id: 'delivery-1',
                    'sms.status': { $in: ['queued', 'dispatched', 'unknown'] }
                },
                {
                    $set: expect.objectContaining({
                        'sms.status': 'delivered'
                    })
                },
                { new: true }
            )
        })

        // POSITIVE: provider states are mapped to the system's SMS states.
        it.each([
            ['dispatched', 'queued', 'dispatched'],
            ['sent', 'queued', 'sent'],
            ['pending', 'unknown', 'queued'],
            ['unknown', 'queued', 'unknown']
        ])(
            'maps provider state %s to local state %s',
            async (providerStatus, currentStatus, expectedStatus) => {
                vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')

                configurePolling({
                    currentStatus,
                    providerMessage: { status: providerStatus }
                })

                await pollQueuedTextBeeDeliveries()

                expect(WarningDelivery.findOneAndUpdate).toHaveBeenNthCalledWith(
                    2,
                    expect.objectContaining({ _id: 'delivery-1' }),
                    {
                        $set: expect.objectContaining({
                            'sms.status': expectedStatus
                        })
                    },
                    { new: true }
                )
            }
        )

        // EDGE: another worker may claim the delivery first.
        it('skips a delivery that another polling worker claimed first', async () => {
            vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')

            const delivery = makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-poll',
                    lastPolledAt: null,
                    error: ''
                }
            })

            WarningDelivery.find.mockReturnValue(queryReturning([delivery]))
            WarningDelivery.findOneAndUpdate.mockResolvedValue(null)

            await pollQueuedTextBeeDeliveries()

            expect(User.findOne).not.toHaveBeenCalled()
            expect(axios.get).not.toHaveBeenCalled()
        })

        // EDGE: ineligible recipients are skipped before querying TextBee.
        it('skips provider status checks for an ineligible recipient', async () => {
            vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')

            configurePolling({
                providerMessage: { status: 'sent' },
                recipient: null
            })

            await pollQueuedTextBeeDeliveries()

            expect(axios.get).not.toHaveBeenCalled()
            expect(WarningDelivery.findOneAndUpdate).toHaveBeenCalledOnce()
        })

        // ERROR: malformed history is logged without overwriting delivery state.
        it('retains queued status when provider history has an invalid shape', async () => {
            vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')

            const delivery = makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-poll',
                    lastPolledAt: null,
                    error: ''
                }
            })

            WarningDelivery.find.mockReturnValue(queryReturning([delivery]))
            WarningDelivery.findOneAndUpdate.mockResolvedValueOnce(delivery)
            User.findOne.mockReturnValue(queryReturning({ _id: CITIZEN_ID }))
            axios.get.mockResolvedValue({ data: { data: 'unexpected' } })

            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

            await pollQueuedTextBeeDeliveries()

            expect(WarningDelivery.findOneAndUpdate).toHaveBeenCalledOnce()
            expect(consoleError).toHaveBeenCalledWith(
                expect.stringContaining('unexpected format')
            )

            consoleError.mockRestore()
        })

        // EDGE: provider history without a matching batch leaves it available for polling.
        it('leaves a queued delivery unchanged when provider history has no matching batch', async () => {
            vi.stubEnv('TEXTBEE_API_KEY', 'test-textbee-key')

            const delivery = makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-poll',
                    lastPolledAt: null,
                    error: ''
                }
            })

            WarningDelivery.find.mockReturnValue(queryReturning([delivery]))
            WarningDelivery.findOneAndUpdate.mockResolvedValueOnce(delivery)
            User.findOne.mockReturnValue(queryReturning({ _id: CITIZEN_ID }))

            axios.get.mockResolvedValue({
                data: {
                    data: [{
                        smsBatchId: 'another-batch',
                        status: 'sent'
                    }]
                }
            })

            const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

            await pollQueuedTextBeeDeliveries()

            expect(WarningDelivery.findOneAndUpdate).toHaveBeenCalledOnce()
            expect(consoleWarn).toHaveBeenCalledWith(
                expect.stringContaining('no matching message')
            )

            consoleWarn.mockRestore()
        })

        // EDGE: the background processor handles an empty queue gracefully.
        it('handles an empty pending webhook queue', async () => {
            TextBeeWebhookEvent.find.mockReturnValue(queryReturning([]))

            await processPendingTextBeeWebhookEvents()

            expect(TextBeeWebhookEvent.updateMany).toHaveBeenCalled()
        })
    })

    // ========================================================
    // ADDITIONAL PROVIDER AND POLLING EDGE CASES
    // ========================================================

    describe('Additional provider and polling edge cases', () => {

        // NEGATIVE: no TextBee API key means SMS fails without HTTP requests.
        it('records an SMS failure when TextBee is not configured', async () => {
            const delivery = useDeliveryStore(makeDelivery())
            AlertNotification.findOneAndUpdate.mockResolvedValue({})

            const result = await deliverWarningToCitizen(makeWarning(), {
                _id: CITIZEN_ID,
                name: 'Mock Citizen',
                phone: '0712345678'
            })

            expect(axios.post).not.toHaveBeenCalled()
            expect(result.sms.status).toBe('failed')
            expect(result.sms.error).toContain('TextBee is not configured')
            expect(delivery.sms.status).toBe('failed')
        })

        // NEGATIVE: a missing Brevo configuration is recorded as a fallback failure.
        it('records a failed email fallback when Brevo is not configured', async () => {
            const delivery = useDeliveryStore(makeDelivery())

            AlertNotification.findOneAndUpdate.mockRejectedValue(
                new Error('mock alert save failed')
            )

            const result = await deliverWarningToCitizen(makeWarning(), {
                _id: CITIZEN_ID,
                name: 'Mock Citizen',
                email: 'citizen@example.test'
            })

            expect(result.inApp.status).toBe('failed')
            expect(result.email.status).toBe('failed')
            expect(result.email.error).toContain('Brevo is not configured')
            expect(axios.post).not.toHaveBeenCalled()
            expect(delivery.email.status).toBe('failed')
        })

        // POSITIVE: nested TextBee responses and trailing slashes are supported.
        it('accepts a nested TextBee success response and normalizes the base URL', async () => {
            useDeliveryStore(makeDelivery())
            AlertNotification.findOneAndUpdate.mockResolvedValue({})

            vi.stubEnv('TEXTBEE_API_KEY', 'unit-test-textbee-key')
            vi.stubEnv('TEXTBEE_BASE_URL', 'https://textbee.example/api/v1///')

            axios.post.mockResolvedValue({
                data: {
                    data: {
                        success: true,
                        smsBatchId: 'nested-batch-1'
                    }
                }
            })

            const result = await deliverWarningToCitizen(makeWarning(), {
                _id: CITIZEN_ID,
                name: 'Mock Citizen',
                phone: '94712345678'
            })

            expect(axios.post).toHaveBeenCalledWith(
                'https://textbee.example/api/v1/gateway/send-sms',
                expect.objectContaining({
                    recipients: ['+94712345678']
                }),
                expect.any(Object)
            )

            expect(result.sms.status).toBe('queued')
            expect(result.sms.providerBatchId).toBe('nested-batch-1')
        })

        // NEGATIVE/ERROR: unsupported provider states are logged safely.
        it('handles an unsupported SMS status returned by TextBee', async () => {
            vi.stubEnv('TEXTBEE_API_KEY', 'unit-test-textbee-key')

            const delivery = makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-unsupported',
                    lastPolledAt: null,
                    error: ''
                }
            })

            WarningDelivery.find.mockReturnValueOnce(queryReturning([delivery]))
            WarningDelivery.findOneAndUpdate.mockResolvedValueOnce(delivery)
            User.findOne.mockReturnValue(queryReturning({ _id: CITIZEN_ID }))

            axios.get.mockResolvedValue({
                data: {
                    data: [{
                        smsBatchId: 'batch-unsupported',
                        status: 'not-a-supported-state'
                    }]
                }
            })

            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

            await pollQueuedTextBeeDeliveries()

            expect(WarningDelivery.findOneAndUpdate).toHaveBeenCalledOnce()
            expect(consoleError).toHaveBeenCalledWith(
                expect.stringContaining('unsupported SMS status')
            )

            consoleError.mockRestore()
        })

        // POSITIVE: nested provider history can contain a messages array.
        it('reads the nested messages array and records a sent timestamp', async () => {
            vi.stubEnv('TEXTBEE_API_KEY', 'unit-test-textbee-key')

            const delivery = makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-nested-history',
                    lastPolledAt: null,
                    error: ''
                }
            })

            const updated = makeDelivery({
                sms: {
                    status: 'sent',
                    providerBatchId: 'batch-nested-history',
                    sentAt: new Date('2026-10-09T10:00:00Z'),
                    error: ''
                }
            })

            WarningDelivery.find
                .mockReturnValueOnce(queryReturning([delivery]))
                .mockResolvedValueOnce([updated])

            WarningDelivery.findOneAndUpdate
                .mockResolvedValueOnce(delivery)
                .mockResolvedValueOnce(updated)

            User.findOne.mockReturnValue(queryReturning({ _id: CITIZEN_ID }))

            axios.get.mockResolvedValue({
                data: {
                    data: {
                        messages: [{
                            batchId: 'batch-nested-history',
                            status: 'sent',
                            sentAt: '2026-10-09T10:00:00Z'
                        }]
                    }
                }
            })

            Warning.findById.mockResolvedValue(makeWarning())

            await pollQueuedTextBeeDeliveries()

            expect(WarningDelivery.findOneAndUpdate).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ _id: delivery._id }),
                {
                    $set: expect.objectContaining({
                        'sms.status': 'sent',
                        'sms.sentAt': expect.any(Date)
                    })
                },
                { new: true }
            )
        })

        // ERROR: provider connection errors are caught by the polling worker.
        it('logs provider transport errors without crashing the polling run', async () => {
            vi.stubEnv('TEXTBEE_API_KEY', 'unit-test-textbee-key')

            const delivery = makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-network-error',
                    lastPolledAt: null,
                    error: ''
                }
            })

            WarningDelivery.find.mockReturnValueOnce(queryReturning([delivery]))
            WarningDelivery.findOneAndUpdate.mockResolvedValueOnce(delivery)
            User.findOne.mockReturnValue(queryReturning({ _id: CITIZEN_ID }))
            axios.get.mockRejectedValue(new Error('mock provider unavailable'))

            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

            await expect(
                pollQueuedTextBeeDeliveries()
            ).resolves.toBeUndefined()

            expect(consoleError).toHaveBeenCalledWith(
                expect.stringContaining('mock provider unavailable')
            )

            consoleError.mockRestore()
        })

        // POSITIVE/ERROR: a polling-reported SMS failure can trigger an email fallback.
        it('starts an email fallback when polling reports SMS failure', async () => {
            vi.stubEnv('TEXTBEE_API_KEY', 'unit-test-textbee-key')
            vi.stubEnv('BREVO_API_KEY', 'unit-test-brevo-key')
            vi.stubEnv('BREVO_SENDER_EMAIL', 'noreply@example.test')

            const delivery = makeDelivery({
                sms: {
                    status: 'queued',
                    providerBatchId: 'batch-failed-poll',
                    lastPolledAt: null,
                    error: ''
                }
            })

            const failedDelivery = makeDelivery({
                sms: {
                    status: 'failed',
                    providerBatchId: 'batch-failed-poll',
                    error: 'Code 42: no route'
                }
            })

            WarningDelivery.find
                .mockReturnValueOnce(queryReturning([delivery]))
                .mockResolvedValueOnce([failedDelivery])

            WarningDelivery.findOneAndUpdate
                .mockResolvedValueOnce(delivery)
                .mockResolvedValueOnce(failedDelivery)
                .mockResolvedValueOnce(failedDelivery)

            WarningDelivery.updateOne.mockResolvedValue({ acknowledged: true })

            User.findOne.mockReturnValue(queryReturning({
                _id: CITIZEN_ID,
                name: 'Mock Citizen',
                email: 'citizen@example.test'
            }))

            Warning.findById.mockResolvedValue(makeWarning())

            axios.get.mockResolvedValue({
                data: {
                    data: [{
                        smsBatchId: 'batch-failed-poll',
                        status: 'failed',
                        errorCode: '42',
                        errorMessage: 'no route'
                    }]
                }
            })

            axios.post.mockResolvedValue({
                data: { messageId: 'fallback-from-poll' }
            })

            await pollQueuedTextBeeDeliveries()

            expect(axios.post).toHaveBeenCalledWith(
                'https://api.brevo.com/v3/smtp/email',
                expect.objectContaining({
                    to: [{
                        email: 'citizen@example.test',
                        name: 'Mock Citizen'
                    }]
                }),
                expect.any(Object)
            )

            expect(WarningDelivery.updateOne).toHaveBeenCalledWith(
                { _id: failedDelivery._id },
                {
                    $set: expect.objectContaining({
                        'email.status': 'sent',
                        'email.providerMessageId': 'fallback-from-poll'
                    })
                }
            )
        })
    })

    // ========================================================
    // CITIZEN NOTIFICATION CONTROLLER TESTS
    // ========================================================

    describe('Citizen notification controller', () => {
        const makeResponse = () => ({
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        })

        // POSITIVE: lists notifications belonging to the current citizen.
        it('lists notifications for the current citizen', async () => {
            const notifications = [{ _id: 'notice-1', readAt: null }]

            AlertNotification.find.mockReturnValue(
                queryReturning(notifications)
            )

            const res = makeResponse()
            const next = vi.fn()

            await listNotifications({
                user: { _id: CITIZEN_ID }
            }, res, next)

            expect(AlertNotification.find).toHaveBeenCalledWith({
                recipientId: CITIZEN_ID
            })

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                notifications
            })

            expect(next).not.toHaveBeenCalled()
        })

        // ERROR: notification-list errors are sent to Express error handling.
        it('forwards notification-list errors', async () => {
            const error = new Error('mock notification query failure')

            AlertNotification.find.mockImplementation(() => {
                throw error
            })

            const next = vi.fn()

            await listNotifications({
                user: { _id: CITIZEN_ID }
            }, makeResponse(), next)

            expect(next).toHaveBeenCalledWith(error)
        })

        // POSITIVE: recent public warning statuses are listed.
        it('lists recent public warnings', async () => {
            const warnings = [{ _id: WARNING_ID, title: 'Flood Warning' }]

            Warning.find.mockReturnValue(queryReturning(warnings))

            const res = makeResponse()

            await listRecentWarnings({}, res, vi.fn())

            expect(Warning.find).toHaveBeenCalledWith({
                status: {
                    $in: ['issued', 'partially_issued', 'delivery_failed']
                }
            })

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                warnings
            })
        })

        // ERROR: failures while listing warnings reach the error handler.
        it('forwards recent-warning query errors', async () => {
            const error = new Error('mock warning list failure')

            Warning.find.mockImplementation(() => {
                throw error
            })

            const next = vi.fn()

            await listRecentWarnings({}, makeResponse(), next)

            expect(next).toHaveBeenCalledWith(error)
        })

        // POSITIVE: retrieves the latest warning addressed to this citizen.
        it('returns the latest warning for the current citizen', async () => {
            const warning = {
                _id: WARNING_ID,
                title: 'Flood Warning'
            }

            Warning.findOne.mockReturnValue(queryReturning(warning))

            const res = makeResponse()

            await getLatestCitizenWarning({
                user: { _id: CITIZEN_ID }
            }, res, vi.fn())

            expect(Warning.findOne).toHaveBeenCalledWith({
                recipientIds: CITIZEN_ID,
                status: {
                    $in: ['issued', 'partially_issued', 'delivery_failed']
                }
            })

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                warning
            })
        })

        // ERROR: latest-warning failures are forwarded to next.
        it('forwards latest-warning lookup errors', async () => {
            const error = new Error('mock latest warning failure')

            Warning.findOne.mockImplementation(() => {
                throw error
            })

            const next = vi.fn()

            await getLatestCitizenWarning({
                user: { _id: CITIZEN_ID }
            }, makeResponse(), next)

            expect(next).toHaveBeenCalledWith(error)
        })

        // EDGE: nearby hazard queries default to a 5 km radius.
        it('uses the default radius for nearby hazards', async () => {
            getNearbyHazards.mockResolvedValue({ hazards: [] })

            const res = makeResponse()

            await nearbyHazards({
                user: { _id: CITIZEN_ID },
                query: {}
            }, res, vi.fn())

            expect(getNearbyHazards).toHaveBeenCalledWith(
                { _id: CITIZEN_ID },
                5
            )

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                hazards: []
            })
        })

        // POSITIVE: a caller-supplied radius is forwarded to the service.
        it('passes a supplied nearby-hazard radius through', async () => {
            getNearbyHazards.mockResolvedValue({
                hazards: ['mock-hazard']
            })

            const res = makeResponse()

            await nearbyHazards({
                user: { _id: CITIZEN_ID },
                query: { radiusKm: '12' }
            }, res, vi.fn())

            expect(getNearbyHazards).toHaveBeenCalledWith(
                { _id: CITIZEN_ID },
                '12'
            )

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                hazards: ['mock-hazard']
            })
        })

        // ERROR: nearby-hazard service errors are forwarded to Express.
        it('forwards nearby-hazard service errors', async () => {
            const error = new Error('mock hazard lookup failure')

            getNearbyHazards.mockRejectedValue(error)

            const next = vi.fn()

            await nearbyHazards({
                user: { _id: CITIZEN_ID },
                query: {}
            }, makeResponse(), next)

            expect(next).toHaveBeenCalledWith(error)
        })

        // POSITIVE: nearby facilities are returned using the supplied radius.
        it('returns nearby facilities', async () => {
            const facilities = [{ id: 'facility-1' }]

            getNearbyFacilities.mockResolvedValue(facilities)

            const res = makeResponse()

            await nearbyFacilities({
                user: { _id: CITIZEN_ID },
                query: { radiusKm: '8' }
            }, res, vi.fn())

            expect(getNearbyFacilities).toHaveBeenCalledWith(
                { _id: CITIZEN_ID },
                '8'
            )

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                facilities
            })
        })

        // ERROR: facility lookup errors reach the error handler.
        it('forwards nearby-facility errors', async () => {
            const error = new Error('mock facility lookup failure')

            getNearbyFacilities.mockRejectedValue(error)

            const next = vi.fn()

            await nearbyFacilities({
                user: { _id: CITIZEN_ID },
                query: {}
            }, makeResponse(), next)

            expect(next).toHaveBeenCalledWith(error)
        })

        // POSITIVE: citizens can view details of an issued warning.
        it('returns warning details', async () => {
            const warning = {
                _id: WARNING_ID,
                title: 'Flood Warning'
            }

            Warning.findOne.mockReturnValue(queryReturning(warning))

            const res = makeResponse()

            await getWarningDetail({
                params: { warningId: WARNING_ID }
            }, res, vi.fn())

            expect(Warning.findOne).toHaveBeenCalledWith({
                _id: WARNING_ID,
                status: {
                    $in: ['issued', 'partially_issued', 'delivery_failed']
                }
            })

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                warning
            })
        })

        // NEGATIVE: unavailable warning details return 404.
        it('returns 404 when warning details are unavailable', async () => {
            Warning.findOne.mockReturnValue(queryReturning(null))

            const res = makeResponse()

            await getWarningDetail({
                params: { warningId: WARNING_ID }
            }, res, vi.fn())

            expect(res.status).toHaveBeenCalledWith(404)
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Warning not found'
            })
        })

        // ERROR: warning-detail query failures are forwarded.
        it('forwards warning-detail errors', async () => {
            const error = new Error('mock detail lookup failure')

            Warning.findOne.mockImplementation(() => {
                throw error
            })

            const next = vi.fn()

            await getWarningDetail({
                params: { warningId: WARNING_ID }
            }, makeResponse(), next)

            expect(next).toHaveBeenCalledWith(error)
        })

        // POSITIVE: a citizen can mark their own notification as read.
        it('marks the current citizen notification as read', async () => {
            const notification = {
                _id: 'notice-1',
                recipientId: CITIZEN_ID,
                readAt: new Date()
            }

            AlertNotification.findOneAndUpdate.mockResolvedValue(notification)

            const res = makeResponse()

            await markNotificationRead({
                user: { _id: CITIZEN_ID },
                params: { notificationId: 'notice-1' }
            }, res, vi.fn())

            expect(AlertNotification.findOneAndUpdate).toHaveBeenCalledWith(
                {
                    _id: 'notice-1',
                    recipientId: CITIZEN_ID
                },
                {
                    $set: { readAt: expect.any(Date) }
                },
                { new: true }
            )

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                notification
            })
        })

        // NEGATIVE: another citizen's notification cannot be marked as read.
        it('returns 404 when the notification does not belong to the citizen', async () => {
            AlertNotification.findOneAndUpdate.mockResolvedValue(null)

            const res = makeResponse()

            await markNotificationRead({
                user: { _id: CITIZEN_ID },
                params: { notificationId: 'missing-notice' }
            }, res, vi.fn())

            expect(res.status).toHaveBeenCalledWith(404)
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Notification not found'
            })
        })

        // ERROR: read-update database failures are forwarded to Express.
        it('forwards mark-as-read errors', async () => {
            const error = new Error('mock read update failure')

            AlertNotification.findOneAndUpdate.mockRejectedValue(error)

            const next = vi.fn()

            await markNotificationRead({
                user: { _id: CITIZEN_ID },
                params: { notificationId: 'notice-1' }
            }, makeResponse(), next)

            expect(next).toHaveBeenCalledWith(error)
        })
    })
})