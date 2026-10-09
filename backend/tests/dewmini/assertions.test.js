import { describe, it, expect } from 'vitest'

// ============================================================
// ASSERTIONS DEMO - Easy to understand examples
// Each test below matches one assertion from your slide.
// In Vitest (JavaScript) we write: expect(actual).matcher(expected)
// If the check fails, the test fails (like "program quits" in Java).
// ============================================================

describe('Assertions - easy examples', () => {

    // --------------------------------------------------------
    // 1. assertEquals(expected, actual)
    // Means: "these two values must be equal"
    // Vitest version: expect(actual).toBe(expected)
    // --------------------------------------------------------
    it('1 - assertEquals: two values are equal', () => {
        const expected = 15
        const actual = 10 + 5 // our program result

        // Check: is actual (15) equal to expected (15)?
        // If yes -> test passes. If no -> test fails.
        expect(actual).toBe(expected)
    })

    // --------------------------------------------------------
    // 2. assertFalse(condition)
    // Means: "this condition must be FALSE"
    // Vitest version: expect(condition).toBe(false)
    // --------------------------------------------------------
    it('2 - assertFalse: condition is false', () => {
        const isRaining = false // imagine we checked the weather

        // Check: isRaining must be false.
        // Passes because it IS false.
        expect(isRaining).toBe(false)
    })

    // --------------------------------------------------------
    // 3. assertNotNull(object)
    // Means: "this object must EXIST (not null / not empty)"
    // Vitest version: expect(object).not.toBeNull()
    // --------------------------------------------------------
    it('3 - assertNotNull: object is not null', () => {
        const user = { name: 'Dewmini' } // imagine we fetched a user from DB

        // Check: user must exist (not null).
        // Passes because user has a value.
        expect(user).not.toBeNull()

        // Extra safety: also check it is defined (not undefined)
        expect(user).toBeDefined()
    })

    // --------------------------------------------------------
    // 4. assertNull(object)
    // Means: "this object must be NULL (empty / nothing)"
    // Vitest version: expect(object).toBeNull()
    // --------------------------------------------------------
    it('4 - assertNull: object is null', () => {
        let deletedUser = null // imagine we deleted the user, so now nothing

        // Check: deletedUser must be null.
        // Passes because it IS null.
        expect(deletedUser).toBeNull()
    })

    // --------------------------------------------------------
    // 5. assertTrue(condition)
    // Means: "this condition must be TRUE"
    // Vitest version: expect(condition).toBe(true)
    // --------------------------------------------------------
    it('5 - assertTrue: condition is true', () => {
        const isLoggedIn = true // imagine login was successful

        // Check: isLoggedIn must be true.
        // Passes because it IS true.
        expect(isLoggedIn).toBe(true)
    })

    // --------------------------------------------------------
    // 6. fail()
    // Means: "force this test to fail right now"
    // Used when code reaches a place it should NEVER reach.
    // Vitest version: expect.fail('reason')  OR  throw new Error()
    // --------------------------------------------------------
    it('6 - fail: force a failure if bad code runs', () => {
        const status = 'OK' // imagine everything is fine

        // Example: if status was ERROR, we want to fail on purpose
        if (status === 'ERROR') {
            // This line forces the test to fail with a message.
            // It only runs when something went wrong.
            expect.fail('Status should never be ERROR here!')
        }

        // Since status is OK, we never hit fail(), so test passes.
        // This line proves we reached the safe place:
        expect(status).toBe('OK')
    })
})
