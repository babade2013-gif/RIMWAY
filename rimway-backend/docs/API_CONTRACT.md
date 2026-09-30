# RIM WAY — API CONTRACT

*Status: FROZEN*
*Phase: 4C*

This document serves as the absolute Source of Truth for the RIM WAY Backend REST API. Flutter engineers must implement their repositories and networking layers strictly adhering to these schemas.

---

## 1. GLOBAL HEADERS & AUTHENTICATION

- **Authorization:** `Bearer <accessToken>`
- **Content-Type:** `application/json`
- **Idempotency:** Specific endpoints (e.g., `POST /api/v1/rides/request`) require an `Idempotency-Key` header (UUID recommended).

---

## 2. AUTH API

### 2.1 Send OTP
- **Method:** `POST`
- **Path:** `/api/v1/auth/send-otp`
- **Auth Required:** No
- **Request Body:**
  ```json
  {
    "phone": "+2221234567"
  }
  ```
- **Business Preconditions:** `phone` must be a valid phone number format.
- **Success Response (200 OK):** *(Note: OTP delivery is currently mock/development only - returns a success message)*
- **Errors:** `400 Bad Request` (Invalid phone)

### 2.2 Verify OTP
- **Method:** `POST`
- **Path:** `/api/v1/auth/verify-otp`
- **Auth Required:** No
- **Request Body:**
  ```json
  {
    "phone": "+2221234567",
    "otp": "1234",
    "role": "PASSENGER" // or "DRIVER"
  }
  ```
- **Business Preconditions:** The current development OTP is strictly `1234`.
- **Success Response (200 OK):**
  ```json
  {
    "accessToken": "eyJ...",
    "refreshToken": "abc123hex..."
  }
  ```
- **Errors:** `401 Unauthorized` (Invalid OTP)

### 2.3 Refresh Token
- **Method:** `POST`
- **Path:** `/api/v1/auth/refresh`
- **Auth Required:** No
- **Request Body:**
  ```json
  {
    "refreshToken": "abc123hex..."
  }
  ```
- **Business Preconditions:** Refresh token rotation is strictly enforced.
  - *First use* = Success (Returns new Access + Refresh token)
  - *Reuse* = `401 Unauthorized` (Token is marked revoked, preventing replay attacks)
  - *Concurrent Refresh* = Protected by DB Atomic Transactions (only 1 succeeds).
- **Success Response (200 OK):**
  ```json
  {
    "accessToken": "eyJ...",
    "refreshToken": "newHex..."
  }
  ```

### 2.4 Logout
- **Method:** `POST`
- **Path:** `/api/v1/auth/logout`
- **Auth Required:** No (but expects refresh token)
- **Request Body:**
  ```json
  {
    "refreshToken": "abc123hex..."
  }
  ```
- **Success Response (200 OK):** `{}`

---

## 3. PASSENGER RIDE API

### 3.1 Estimate Fare
- **Method:** `POST`
- **Path:** `/api/v1/rides/estimate`
- **Auth Required:** No (Publicly accessible)
- **Request Body:**
  ```json
  {
    "pickupLat": 18.08,
    "pickupLng": -15.97,
    "dropoffLat": 18.09,
    "dropoffLng": -15.98,
    "serviceTypeId": "uuid-here"
  }
  ```
- **Business Preconditions:** `serviceTypeId` must exist in DB. Distance/Time routing engine is currently using a static fallback (10km, 20min) pending Google Maps/OSRM integration.
- **Success Response (201 Created):**
  ```json
  {
    "estimatedFare": 50,
    "distanceKm": 10,
    "estimatedTimeMin": 20,
    "serviceType": { /* details */ }
  }
  ```

### 3.2 Request Ride
- **Method:** `POST`
- **Path:** `/api/v1/rides/request`
- **Auth Required:** Yes (`Role: PASSENGER`)
- **Headers:** `Idempotency-Key: <unique-uuid>`
- **Request Body:**
  ```json
  {
    "pickupLat": 18.08,
    "pickupLng": -15.97,
    "pickupName": "Tevragh Zeina",
    "dropoffLat": 18.09,
    "dropoffLng": -15.98,
    "dropoffName": "Ksar",
    "serviceTypeId": "uuid-here"
  }
  ```
- **Idempotency Rules:**
  - Same Key + Same Passenger = Returns existing Ride (201).
  - Same Key + Different Passenger = `403 Forbidden` (IDOR Protection).
- **State Changes:** Ride starts in `SEARCHING` state. AuditLog `RIDE_REQUESTED` is atomically written.
- **Success Response (201 Created):** Returns the created `Ride` object including `id`, `status: 'SEARCHING'`, `stateVersion: 1`, `rideCode` (OTP).

### 3.3 Get Current Ride
- **Method:** `GET`
- **Path:** `/api/v1/rides/current`
- **Auth Required:** Yes (`Role: PASSENGER`)
- **Success Response (200 OK):** Returns the current active ride if status is NOT in `[COMPLETED, CANCELLED_BY_PASSENGER, CANCELLED_BY_DRIVER, NO_DRIVER_FOUND]`. If no active ride, returns:
  ```json
  { "status": "NO_RIDE_FOUND" }
  ```

### 3.4 Cancel Ride
- **Method:** `POST`
- **Path:** `/api/v1/rides/cancel`
- **Auth Required:** Yes (`Role: PASSENGER`)
- **Request Body:**
  ```json
  {
    "rideId": "uuid-here"
  }
  ```
- **Business Preconditions:** Only the owning Passenger can cancel. Cannot cancel if the ride is already `IN_PROGRESS` or `COMPLETED`.
- **Success Response (201 Created):** Returns updated ride with `status: 'CANCELLED_BY_PASSENGER'`.

---

## 4. DRIVER API

### 4.1 Update Status
- **Method:** `POST`
- **Path:** `/api/v1/drivers/status`
- **Auth Required:** Yes (`Role: DRIVER`)
- **Request Body:**
  ```json
  { "isOnline": true }
  ```

### 4.2 Update Location
- **Method:** `POST`
- **Path:** `/api/v1/drivers/location`
- **Auth Required:** Yes (`Role: DRIVER`)
- **Request Body:**
  ```json
  {
    "latitude": 18.08,
    "longitude": -15.97
  }
  ```
- **Business Preconditions:** Stored securely using Redis GEO for fast spatial dispatch queries.

### 4.3 Accept Ride
- **Method:** `POST`
- **Path:** `/api/v1/drivers/rides/:id/accept`
- **Auth Required:** Yes (`Role: DRIVER`)
- **State Changes:** `SEARCHING` -> `DRIVER_ASSIGNED`.
- **Race Condition / Concurrency (CRITICAL):**
  - Protected via `updateMany` locking.
  - If Driver A and Driver B accept simultaneously, ONE succeeds, the other receives `409 Conflict`.
- **Errors:** `409 Conflict` (Ride already taken or state mismatch).

### 4.4 Driver Arrived
- **Method:** `POST`
- **Path:** `/api/v1/drivers/rides/:id/arrive`
- **Auth Required:** Yes (`Role: DRIVER`)
- **Request Body:**
  ```json
  { "stateVersion": 2 }
  ```
- **State Changes:** `DRIVER_ASSIGNED` -> `DRIVER_ARRIVED`.
- **Errors:** `409 Conflict` (Stale stateVersion or wrong driver).

### 4.5 Start Ride
- **Method:** `POST`
- **Path:** `/api/v1/drivers/rides/:id/start`
- **Auth Required:** Yes (`Role: DRIVER`)
- **Request Body:**
  ```json
  { 
    "otp": "4-digit-code",
    "stateVersion": 3
  }
  ```
- **State Changes:** `WAITING_FOR_PASSENGER` -> `IN_PROGRESS`.
- **Errors:** `409 Conflict` (Invalid OTP).

### 4.6 Complete Ride
- **Method:** `POST`
- **Path:** `/api/v1/drivers/rides/:id/complete`
- **Auth Required:** Yes (`Role: DRIVER`)
- **Request Body:**
  ```json
  { "stateVersion": 4 }
  ```
- **State Changes:** `IN_PROGRESS` -> `COMPLETED`.

---

## 5. RIDE STATE MACHINE & STATE VERSION CONTRACT

### Permitted Flow
`SEARCHING` -> `DRIVER_ASSIGNED` -> `DRIVER_ARRIVED` -> `PASSENGER_BOARDED` -> `IN_PROGRESS` -> `COMPLETED`

### Edge States
- `CANCELLED_BY_PASSENGER`
- `NO_DRIVER_FOUND` (Triggered silently by Backend Timeout Cron Job. Default timeout: 30s)

### StateVersion (Optimistic Concurrency)
- Flutter MUST include the latest known `stateVersion` in all driver mutation requests.
- If Flutter sends an outdated `stateVersion` (e.g. sending 2 when DB is at 3), Backend responds with `409 Conflict`. Flutter must sync and retry or alert the user.

---

## 6. ERROR HANDLING STANDARD

Flutter must anticipate standard NestJS HTTP exceptions:
- **400 Bad Request:** Validation failure (e.g., missing fields in DTO).
- **401 Unauthorized:** Invalid, expired, or missing JWT. Or revoked Refresh Token.
- **403 Forbidden:** Role mismatch (e.g., Passenger trying to hit Driver endpoint) or IDOR attempt.
- **404 Not Found:** Resource missing.
- **409 Conflict:** Concurrency failure, Race condition loss, Invalid OTP, or State Machine transition violation.
- **500 Internal Server Error:** Unexpected backend fault.
