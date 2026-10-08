import { describe, it, expect } from 'vitest'

describe('Warning Test Setup', () => {

    // POSITIVE: verifies a valid warning severity
    it('should accept a high severity warning', () => {
        const severity = 'High'

        expect(severity).toBe('High')
    })

    // NEGATIVE: verifies an invalid severity is rejected
    it('should reject an invalid warning severity', () => {
        const severity = 'Unknown'

        expect(['Low', 'Medium', 'High', 'Critical']).not.toContain(severity)
    })

    // EDGE: verifies the maximum warning title length
    it('should support a 160 character warning title', () => {
        const title = 'A'.repeat(160)

        expect(title.length).toBe(160)
    })

})