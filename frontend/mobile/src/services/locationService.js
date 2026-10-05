export const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(
                new Error(
                    'Location services are not supported by this device.'
                )
            )
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                resolve({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracyM: position.coords.accuracy
                })
            },
            (error) => {
                let message = 'Unable to get your location.'

                if (error.code === error.PERMISSION_DENIED) {
                    message =
                        'Location permission was denied. You can select the hazard location manually on the map.'
                }

                if (error.code === error.POSITION_UNAVAILABLE) {
                    message =
                        'Your current location is unavailable. You can select the hazard location manually on the map.'
                }

                if (error.code === error.TIMEOUT) {
                    message =
                        'Location detection timed out. You can select the hazard location manually on the map.'
                }

                reject(new Error(message))
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        )
    })
}