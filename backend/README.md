# Authentication

The API uses an HTTP-only JWT cookie for browser sessions. Set `MONGO_URI` and
`JWT_SECRET` in `backend/.env` before starting the API. `JWT_SECRET` should be a
long, random secret. In production, serve the API over HTTPS so the session
cookie is marked `Secure`.

The web frontend runs on port `5173` and the citizen mobile frontend on `5174`
by default. For other deployments, set `CLIENT_URLS` to a comma-separated list
of the exact frontend origins (for example, `https://staff.example.com,https://citizen.example.com`).
The older single-origin `CLIENT_URL` setting is also accepted.
Set `VITE_MOBILE_APP_URL` in the web frontend and `VITE_WEB_APP_URL` in the
mobile frontend when the portals are deployed at non-default addresses.

## Account flow

- `POST /api/auth/register` accepts `name`, `email`, `password`, and `phone`.
  It may include `location` as
  `{ "latitude": 6.9, "longitude": 79.8 }`. Every registration is assigned the
  `citizen` role and must use a unique email and password of at least 8
  characters. Location is optional; when supplied, the citizen is matched to
  any DMC target areas containing that point.
- `POST /api/auth/login` accepts `email`, `password`, and `client`. Use
  `client: "mobile"` for citizen accounts and `client: "web"` for staff
  accounts. The API rejects a valid account when it attempts to use the other
  portal.
- `GET /api/auth/me` returns the signed-in user; `POST /api/auth/logout`
  clears the session cookie.

The only role names to store in MongoDB are `citizen`, `dmcofficer`,
`dutyofficer`, and `ngomanager`. New accounts are `citizen`. Staff roles are
assigned manually by setting `role` to `dmcofficer`, `dutyofficer`, or
`ngomanager`. The web dashboard route is selected from that role. Citizen
accounts use the mobile frontend.

The corresponding web dashboard URLs are `/dmcofficer/dashboard`,
`/dutyofficer/dashboard`, and `/ngomanager/dashboard`. Their API prefixes are
`/api/dmcofficer`, `/api/dutyofficer`, and `/api/ngomanager`; citizen API routes
use `/api/citizen`.

Older values such as `CITIZEN`, `DMC_OFFICER`, `DUTY_OFFICER`, and
`NGO_MANAGER` are still recognized when reading existing accounts, but all
new and updated role values and API responses use the simple lowercase names.

Role-specific API routers also require a valid session and matching role.

## DMC officer features

DMC officer routes use `/api/dmcofficer` and require the `dmcofficer` role.
Target-area polygons are GeoJSON and use MongoDB geospatial queries. Matched
citizen IDs are stored on each target area; only current `citizen` accounts
are counted or selected for warning drafts. Warning creation saves a draft
and a recipient snapshot; it does not send SMS or push notifications.

The map uses OpenStreetMap tiles as its base layer and optional OpenWeather
precipitation, clouds, or temperature overlays. Configure `OPENWEATHER_KEY`
in `backend/.env` to enable those overlays. The key is proxied by the
authenticated DMC API and is not exposed to the browser.
