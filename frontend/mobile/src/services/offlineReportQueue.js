const DB_NAME = 'disaster-management-db'
const DB_VERSION = 1
const STORE_NAME = 'offline-hazard-reports'

const openDatabase = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onupgradeneeded = (event) => {
            const db = event.target.result

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                })

                store.createIndex('syncStatus', 'syncStatus', {
                    unique: false,
                })

                store.createIndex('createdLocallyAt', 'createdLocallyAt', {
                    unique: false,
                })
            }
        }

        request.onsuccess = () => {
            resolve(request.result)
        }

        request.onerror = () => {
            reject(request.error)
        }
    })
}

/**
 * Save a hazard report locally.
 */
export const saveOfflineReport = async (report) => {
    const db = await openDatabase()

    const offlineReport = {
        id: crypto.randomUUID(),

        hazardType: report.hazardType,

        description: report.description || '',

        location: {
            latitude: report.location.latitude,
            longitude: report.location.longitude,
            accuracy: report.location.accuracy ?? null,
            source: report.location.source || 'unknown',
        },

        // Store the original File/Blob.
        photo: report.photo || null,

        // Keep the original hazard capture time.
        capturedAt: report.capturedAt,

        syncStatus: 'pending',

        createdLocallyAt: new Date().toISOString(),

        syncAttempts: 0,

        lastSyncAttemptAt: null,

        lastSyncError: null,
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)

        const request = store.add(offlineReport)

        request.onsuccess = () => {
            resolve(offlineReport)
        }

        request.onerror = () => {
            reject(request.error)
        }

        transaction.oncomplete = () => {
            db.close()
        }

        transaction.onerror = () => {
            reject(transaction.error)
            db.close()
        }
    })
}

/**
 * Get all reports waiting to be synced.
 */
export const getPendingReports = async () => {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly')
        const store = transaction.objectStore(STORE_NAME)
        const index = store.index('syncStatus')

        const request = index.getAll('pending')

        request.onsuccess = () => {
            resolve(request.result)
        }

        request.onerror = () => {
            reject(request.error)
        }

        transaction.oncomplete = () => {
            db.close()
        }

        transaction.onerror = () => {
            reject(transaction.error)
            db.close()
        }
    })
}

/**
 * Get one locally stored report.
 */
export const getOfflineReport = async (id) => {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly')
        const store = transaction.objectStore(STORE_NAME)

        const request = store.get(id)

        request.onsuccess = () => {
            resolve(request.result || null)
        }

        request.onerror = () => {
            reject(request.error)
        }

        transaction.oncomplete = () => {
            db.close()
        }

        transaction.onerror = () => {
            reject(transaction.error)
            db.close()
        }
    })
}

/**
 * Delete a report only after successful server synchronization.
 */
export const deleteOfflineReport = async (id) => {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)

        const request = store.delete(id)

        request.onsuccess = () => {
            resolve(true)
        }

        request.onerror = () => {
            reject(request.error)
        }

        transaction.oncomplete = () => {
            db.close()
        }

        transaction.onerror = () => {
            reject(transaction.error)
            db.close()
        }
    })
}

/**
 * Update an offline report.
 */
export const updateOfflineReport = async (id, updates) => {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite')
        const store = transaction.objectStore(STORE_NAME)

        const getRequest = store.get(id)

        getRequest.onsuccess = () => {
            const existingReport = getRequest.result

            if (!existingReport) {
                reject(new Error(`Offline report not found: ${id}`))
                return
            }

            const updatedReport = {
                ...existingReport,
                ...updates,
            }

            const updateRequest = store.put(updatedReport)

            updateRequest.onsuccess = () => {
                resolve(updatedReport)
            }

            updateRequest.onerror = () => {
                reject(updateRequest.error)
            }
        }

        getRequest.onerror = () => {
            reject(getRequest.error)
        }

        transaction.oncomplete = () => {
            db.close()
        }

        transaction.onerror = () => {
            reject(transaction.error)
            db.close()
        }
    })
}

/**
 * Convert a stored photo back into a File when necessary.
 */
const restorePhotoFile = (photo) => {
    if (!photo) {
        return null
    }

    if (photo instanceof File) {
        return photo
    }

    if (photo instanceof Blob) {
        return new File(
            [photo],
            photo.name || `hazard-photo-${Date.now()}.jpg`,
            {
                type: photo.type || 'image/jpeg',
                lastModified: photo.lastModified || Date.now(),
            }
        )
    }

    return null
}

/**
 * Synchronize all pending offline reports with the backend.
 *
 * A local report is deleted ONLY after the API confirms
 * that the report was successfully created.
 */
export const syncPendingReports = async (createHazardReport) => {
    const pendingReports = await getPendingReports()

    if (!pendingReports.length) {
        return {
            synced: 0,
            failed: 0,
        }
    }

    let synced = 0
    let failed = 0

    for (const offlineReport of pendingReports) {
        try {
            await updateOfflineReport(offlineReport.id, {
                syncAttempts: (offlineReport.syncAttempts || 0) + 1,
                lastSyncAttemptAt: new Date().toISOString(),
                lastSyncError: null,
            })

            const reportForUpload = {
                hazardType: offlineReport.hazardType,

                description: offlineReport.description,

                location: offlineReport.location,

                capturedAt: offlineReport.capturedAt,

                photo: restorePhotoFile(offlineReport.photo),

                photoPreview: '',
            }

            // Existing backend endpoint.
            // This must succeed before deleting the local record.
            await createHazardReport(reportForUpload)

            await deleteOfflineReport(offlineReport.id)

            synced += 1

            console.log(
                `[Offline Sync] Report ${offlineReport.id} synced successfully.`
            )
        } catch (error) {
            failed += 1

            await updateOfflineReport(offlineReport.id, {
                lastSyncError:
                    error.message || 'Synchronization failed.',
            }).catch(() => {
                // Do not let an IndexedDB update error stop other reports.
            })

            console.warn(
                `[Offline Sync] Report ${offlineReport.id} could not be synced. It remains in IndexedDB.`,
                error
            )
        }
    }

    return {
        synced,
        failed,
    }
}