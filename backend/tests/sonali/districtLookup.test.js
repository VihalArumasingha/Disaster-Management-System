import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import getDistrictFromCoordinates from '../../utils/districtLookup.js'

vi.mock('axios')

describe('District Lookup', () => {
    beforeEach(() => {
        // Clear all mock call history before each test to ensure test isolation
        vi.clearAllMocks()
    })

    // ==================== EDGE CASES / VALIDATION ====================

    // Edge case: verifies behaviour when longitude is not a valid number
    it('should return null for invalid finite longitude', async () => {

        const result = await getDistrictFromCoordinates(NaN, 6.9271)
        expect(result).toBeNull()
        expect(axios.get).not.toHaveBeenCalled()
    })

    // Edge case: verifies behaviour when latitude is not a valid number
    it('should return null for invalid finite latitude', async () => {
        const result = await getDistrictFromCoordinates(79.8612, Infinity)
        expect(result).toBeNull()
        expect(axios.get).not.toHaveBeenCalled()
    })

    // Edge case: verifies behaviour when coordinates are entirely missing
    it('should return null for missing coordinates', async () => {
        const result = await getDistrictFromCoordinates()
        expect(result).toBeNull()
        expect(axios.get).not.toHaveBeenCalled()
    })

    // ==================== API ERROR RESPONSES ====================

    // Negative case: verifies that the service gracefully handles explicit error responses from the API
    it('should return null if response has error', async () => {
        // Mock the API response to return an error object
        axios.get.mockResolvedValue({
            data: { error: { message: 'Invalid query' } }
        })

        const result = await getDistrictFromCoordinates(79.8612, 6.9271)

        expect(result).toBeNull()
        expect(axios.get).toHaveBeenCalledTimes(1)
    })

    // Negative case: verifies that the service handles malformed API responses (features not array)
    it('should return null if features is not an array', async () => {
        axios.get.mockResolvedValue({
            data: { features: null }
        })

        const result = await getDistrictFromCoordinates(79.8612, 6.9271)

        expect(result).toBeNull()
    })

    // Negative case: verifies that the service handles empty feature arrays
    it('should return null if features array is empty', async () => {
        axios.get.mockResolvedValue({
            data: { features: [] }
        })

        const result = await getDistrictFromCoordinates(79.8612, 6.9271)

        expect(result).toBeNull()
    })

    // ==================== MISSING DISTRICT INFORMATION ====================

    // Negative case: verifies that the service handles responses where attributes object exists but district_name is missing
    it('should return null if district_name is missing', async () => {
        axios.get.mockResolvedValue({
            data: {
                features: [{ attributes: {} }]
            }
        })

        const result = await getDistrictFromCoordinates(79.8612, 6.9271)

        expect(result).toBeNull()
    })

    // Negative case: verifies that the service handles unexpected data types for district_name
    it('should return null if district_name is not a string', async () => {
        axios.get.mockResolvedValue({
            data: {
                features: [{ attributes: { district_name: 123 } }]
            }
        })

        const result = await getDistrictFromCoordinates(79.8612, 6.9271)

        expect(result).toBeNull()
    })

    // ==================== SUCCESSFUL DISTRICT LOOKUP ====================

    // Positive case: verifies that a successful lookup returns a correctly trimmed district name
    it('should return trimmed district name on success', async () => {
        axios.get.mockResolvedValue({
            data: {
                features: [{ attributes: { district_name: '  Colombo  ' } }]
            }
        })

        const result = await getDistrictFromCoordinates(79.8612, 6.9271)

        expect(result).toBe('Colombo')
        expect(axios.get).toHaveBeenCalledWith(
            'https://gisapps.nsdi.gov.lk/server/rest/services/BaseMap/BaseMap/MapServer/3/query',
            expect.objectContaining({
                params: expect.objectContaining({
                    geometry: '79.8612,6.9271'
                })
            })
        )
    })

    // ==================== API / REQUEST FAILURES ====================

    // Negative case: verifies that network errors are caught and handled returning null
    it('should return null if request fails (throws error)', async () => {
        // Mock a network error during the API request
        axios.get.mockRejectedValue(new Error('Network error'))

        const result = await getDistrictFromCoordinates(79.8612, 6.9271)

        expect(result).toBeNull()
    })

    // ==================== ADDITIONAL EDGE CASES ====================

    // Edge case: verifies that perfectly valid 0, 0 coordinates are handled successfully
    it('should handle zero coordinates properly', async () => {
        axios.get.mockResolvedValue({
            data: { features: [{ attributes: { district_name: 'Equator' } }] }
        })
        const result = await getDistrictFromCoordinates(0, 0)
        expect(result).toBe('Equator')
    })

    // Edge case: verifies behaviour when latitude is outside normal boundaries but still finite
    it('should return null if latitude is out of bounds', async () => {
        // Since we only check Number.isFinite, it still calls the API, but we simulate API error
        axios.get.mockResolvedValue({ data: { error: true } })
        const result = await getDistrictFromCoordinates(79.86, 100)
        expect(result).toBeNull()
    })

    // Edge case: verifies behaviour when the entire attributes object is missing from a feature
    it('should return null if attributes object is entirely missing', async () => {
        axios.get.mockResolvedValue({
            data: { features: [ { geometry: {} } ] }
        })
        const result = await getDistrictFromCoordinates(79.8612, 6.9271)
        expect(result).toBeNull()
    })

    // Positive case: verifies that strings that are already trimmed are not improperly modified
    it('should not trim if district_name is already perfectly trimmed', async () => {
        axios.get.mockResolvedValue({
            data: { features: [{ attributes: { district_name: 'Kandy' } }] }
        })
        const result = await getDistrictFromCoordinates(80.6367, 7.2906)
        expect(result).toBe('Kandy')
    })

    // Negative case: verifies that API timeouts are caught and returning null
    it('should handle API timeout gracefully', async () => {
        const timeoutError = new Error('timeout')
        timeoutError.code = 'ECONNABORTED'
        axios.get.mockRejectedValue(timeoutError)
        const result = await getDistrictFromCoordinates(79.8612, 6.9271)
        expect(result).toBeNull()
    })
})
