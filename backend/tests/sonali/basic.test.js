import { describe, it, expect } from 'vitest'

describe('Sewmini Test Folder', () => {

    // POSITIVE: verifies that basic calculation works
    it('should correctly add two numbers', () => {
        const result = 10 + 5

        expect(result).toBe(15)
    })

    // EDGE: verifies multiplication by zero
    it('should return zero when multiplying by zero', () => {
        const result = 10 * 0

        expect(result).toBe(0)
    })

    // NEGATIVE: verifies that an incorrect result fails the expected condition
    it('should confirm that 10 + 5 is not 20', () => {
        const result = 10 + 5

        expect(result).not.toBe(20)
    })

})