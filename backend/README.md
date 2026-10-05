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
are counted or selected for warnings. A warning is saved as a draft, can be
edited, and requires a separate read-only review and explicit issue confirmation.
The audience is refreshed from the selected polygons at issue time.

On issue, the API saves one in-app alert and attempts an SMS for each eligible
citizen. If either primary channel fails, it attempts email as a fallback.
Configure these backend environment variables:

- `TEXTBEE_API_KEY` for TextBee SMS. The API uses the `x-api-key` header with
  `POST https://api.textbee.dev/api/v1/gateway/send-sms`; `TEXTBEE_BASE_URL`
  can override the API base URL for a self-hosted deployment. TextBee requires
  phone numbers in E.164 format and an enabled, paired Android sending device.
- `TEXTBEE_WEBHOOK_SECRET` for signed delivery-status callbacks. Create a
  TextBee webhook subscription pointing to
  `https://<your-public-api-host>/api/webhooks/textbee`, using the same
  20-character-or-longer signing secret, and select `MESSAGE_SENT`,
  `MESSAGE_DELIVERED`, `MESSAGE_FAILED`, and `UNKNOWN_STATE`. The API verifies
  `X-Signature` over the raw request body and processes events idempotently.
  For local development, TextBee requires a public HTTPS URL (a tunnel can
  expose the local API); localhost URLs are not reachable by TextBee.
- The backend also polls TextBee's authenticated message history every 10
  seconds for queued or unknown SMS batches and refreshes warning summaries.
  This provides status updates without a webhook; configuring the webhook is
  still recommended for faster updates and remains supported.
- `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` for Brevo email fallback.
  `BREVO_SENDER_NAME` is optional.

Per-recipient channel outcomes and provider errors are retained with the
warning. A successful TextBee response initially marks the SMS as queued.
`MESSAGE_SENT` means the carrier accepted it and `MESSAGE_DELIVERED` means the
carrier provided a handset delivery report. `MESSAGE_FAILED` updates only that
recipient's SMS and triggers only that recipient's email fallback. `UNKNOWN_STATE`
is surfaced for review and does not trigger fallback because it is not a
confirmed failure. Partial or failed issuances can be retried from the warnings
page; successful channels are not sent again.
Citizen in-app alerts are available
from the authenticated `GET /api/citizen/notifications` endpoint and can be
marked read with `PATCH /api/citizen/notifications/:notificationId/read`.
Recent warnings addressed to the signed-in citizen are available from
`GET /api/citizen/warnings/recent`.

The map uses OpenStreetMap tiles as its base layer and optional OpenWeather
precipitation, clouds, or temperature overlays. Configure `OPENWEATHER_KEY`
in `backend/.env` to enable those overlays. The key is proxied by the
authenticated DMC API and is not exposed to the browser.
