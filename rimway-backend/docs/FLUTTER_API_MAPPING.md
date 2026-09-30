# RIM WAY — FLUTTER API MAPPING

*Status: FROZEN*
*Phase: 4C*

This document provides a conceptual mapping between Flutter UI actions/states and the Backend REST/WebSocket contracts.

---

## 1. AUTH FLOW

| Flutter Feature | Endpoint / Action | Request DTO | Response |
| :--- | :--- | :--- | :--- |
| Enter Phone Number | `POST /api/v1/auth/send-otp` | `{ phone }` | Success Message |
| Submit OTP | `POST /api/v1/auth/verify-otp` | `{ phone, otp, role }` | `{ accessToken, refreshToken }` |
| App Starts (Auto-login) | `POST /api/v1/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` |
| Logout | `POST /api/v1/auth/logout` | `{ refreshToken }` | `{}` |

---

## 2. PASSENGER RIDE FLOW

| Flutter UI State | Endpoint / Action | Expected Backend State |
| :--- | :--- | :--- |
| Map / Choose Destination | `POST /api/v1/rides/estimate` | N/A |
| Finding a Driver | `POST /api/v1/rides/request` | `SEARCHING` |
| *Waiting for Match* | Listen to WS `ride_status_changed` | `SEARCHING` |
| Driver is Coming | WS Event Received (`status: DRIVER_ASSIGNED`) | `DRIVER_ASSIGNED` |
| Driver has Arrived | WS Event Received (`status: DRIVER_ARRIVED`) | `DRIVER_ARRIVED` |
| Ride Active | WS Event Received (`status: IN_PROGRESS`) | `IN_PROGRESS` |
| Ride Completed | WS Event Received (`status: COMPLETED`) | `COMPLETED` |
| Cancel Ride | `POST /api/v1/rides/cancel` | `CANCELLED_BY_PASSENGER` |
| No Driver Available | WS Event Received (`status: NO_DRIVER_FOUND`) | `NO_DRIVER_FOUND` |

---

## 3. DRIVER RIDE FLOW

| Flutter UI State | Endpoint / Action | Expected Backend State |
| :--- | :--- | :--- |
| Go Online | `POST /api/v1/drivers/status` | N/A |
| Tracking (Background) | `POST /api/v1/drivers/location` | N/A |
| *Waiting for Ride* | Listen to WS `ride_requested` | N/A |
| Accept Ride | `POST /api/v1/drivers/rides/:id/accept` | `DRIVER_ASSIGNED` |
| Navigate to Pickup | Drive (UI Map) | `DRIVER_ASSIGNED` |
| Press "Arrived" | `POST /api/v1/drivers/rides/:id/arrive` | `DRIVER_ARRIVED` |
| Ask for OTP & Start | `POST /api/v1/drivers/rides/:id/start` (with OTP) | `IN_PROGRESS` |
| Press "Complete" | `POST /api/v1/drivers/rides/:id/complete` | `COMPLETED` |

---

## 4. UI STATE TRANSLATION DICTIONARY

Flutter should strictly map backend states to these UI meanings. Do not invent intermediate UI states that don't match the backend without relying on these as the source of truth.

- **`SEARCHING`**: UI shows "Finding a driver...". Cancel button available.
- **`DRIVER_ASSIGNED`**: UI shows "Driver is on the way". Show driver location (if supported). Cancel button available.
- **`DRIVER_ARRIVING` / `DRIVER_ARRIVED`**: UI shows "Driver has arrived. Please meet them."
- **`WAITING_FOR_PASSENGER`**: UI shows "Waiting for passenger to provide OTP."
- **`IN_PROGRESS`**: UI shows "Heading to destination". Cancel button disabled.
- **`COMPLETED`**: UI shows "Ride finished. Fare: X."
- **`CANCELLED_BY_PASSENGER`**: UI shows "You cancelled the ride."
- **`CANCELLED_BY_DRIVER`**: UI shows "The driver cancelled the ride."
- **`NO_DRIVER_FOUND`**: UI shows "No drivers available right now. Please try again."
