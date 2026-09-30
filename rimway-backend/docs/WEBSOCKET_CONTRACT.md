# RIM WAY — WEBSOCKET CONTRACT

*Status: FROZEN*
*Phase: 4C*

This document dictates how the Flutter application communicates with the RIM WAY WebSocket server via Socket.IO.

---

## 1. CONNECTION & AUTHENTICATION

Flutter must connect to the backend WebSocket using `socket.io-client`.

### Authentication
Authentication is strict and requires the active JWT `accessToken`.

**Two methods are supported by the backend:**
1. Using the `auth` object during handshake (Recommended):
   ```javascript
   io(url, { auth: { token: "eyJ..." } })
   ```
2. Using the `Authorization` header:
   ```javascript
   io(url, { extraHeaders: { Authorization: "Bearer eyJ..." } })
   ```

**Failure:** If the token is missing or invalid, the socket connection is immediately closed (`client.disconnect()`).

---

## 2. ROOMS

The backend dynamically assigns the client to specific rooms upon successful connection based on their JWT payload.

- **`user_<userId>`**: Every user (Passenger or Driver) joins their personal unique room.
- **`driver_<driverId>`**: A driver explicitly joins their driver room (used to broadcast ride events directly to the assigned driver).
- **`available_drivers`**: Any user with `role === 'DRIVER'` joins this global broadcast room (used for dispatching new rides).

---

## 3. EVENTS (FLUTTER TO BACKEND)

Currently, the architecture heavily relies on the **REST API** to trigger mutations (request ride, accept, arrive). The WebSocket is primarily used as a **downstream channel** from the server to the client.

Flutter does NOT need to emit events manually for ride progression. It should call REST APIs, and the backend will trigger the corresponding WS broadcasts.

---

## 4. EVENTS (BACKEND TO FLUTTER)

Flutter must listen to these events.

### 4.1 `ride_requested`
- **Sender:** Backend (triggered by Passenger REST request).
- **Receiver:** Room `available_drivers`
- **Payload Example:**
  ```json
  {
    "id": "ride-uuid",
    "passengerId": "user-uuid",
    "status": "SEARCHING",
    "pickupLat": 18.08,
    "pickupLng": -15.97,
    "pickupName": "Tevragh Zeina",
    "dropoffLat": 18.09,
    "dropoffLng": -15.98,
    "dropoffName": "Ksar",
    "estimatedFare": 50
  }
  ```
- **Flutter Action:** Driver App shows the incoming ride popup.

### 4.2 `ride_status_changed`
- **Sender:** Backend (triggered by any Ride state mutation).
- **Receiver:** 
  - Room `user_<passengerId>`
  - Room `driver_<driverId>` (if assigned)
- **Payload Example:**
  ```json
  {
    "rideId": "ride-uuid",
    "status": "DRIVER_ARRIVED",
    "stateVersion": 4,
    "updatedAt": "2026-09-14T01:15:09Z"
  }
  ```
- **Flutter Action:** Update the local ride state.

---

## 5. THE FLUTTER EVENT RULE (CRITICAL)

> **Flutter must treat the Backend REST API + WebSocket state as authoritative.**

Because WebSocket packets can arrive out of order, or network reconnections might cause delayed events, Flutter **MUST** check the `stateVersion` before applying a UI update.

**Rule:**
```dart
if (incomingPayload.stateVersion > currentLocalRide.stateVersion) {
    updateUi(incomingPayload.status);
    currentLocalRide.stateVersion = incomingPayload.stateVersion;
} else {
    // Ignore stale WebSocket event
}
```

This prevents the UI from bouncing backward if an older event arrives late.
