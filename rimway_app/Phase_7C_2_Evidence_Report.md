# PHASE 7C.2 EVIDENCE REPORT

## Environment

* Flutter actual version: 3.47.4
* Dart actual version: 3.13.3
* Android SDK: 36.1.0
* Emulator/device: Android Emulator 36.3.10.0 (API 36)
* Backend: Node.js / NestJS (Verified via Vitest)

## Files changed

* `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\lib\core\websocket\ws_client.dart`
* `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\lib\features\captain\application\captain_provider.dart`
* `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\test\captain_provider_test.dart`

## WebSocket source flow

* **Backend emit:** `RideService.requestRide` emits `ride_requested` via Redis and `RideGateway` to `driver_${driverId}`.
* **WsClient:** Listens to `ride_requested`, parses the `Map<String, dynamic>`, adds `event_type`, and broadcasts via `_rideEventController`.
* **CaptainProvider:** Automatically connects WS on `fetchCurrentRide()`. Subscribes strictly once via `_initSubscriptions()`. Receives event in `_handleIncomingRide()`.
* **UI:** Updates `incomingRideRequest` state. `CaptainHomeScreen` renders `IncomingRideBottomSheet` automatically based on state.

## Authentication

* **DRIVER role:** Verified. Captain token explicitly uses `ROLE = DRIVER`. Passenger tokens cannot establish Captain WebSocket sessions.
* **driverId:** Verified. Server maps the connection using the authenticated JWT's payload.
* **access token:** Verified. `WsClient` injects the SecureStorage `token` in its `setAuth({'token': token})`.
* **WebSocket identity:** Verified. The server emits exclusively to the targeted socket room: `driver_${driverId}`.

## Event handling

* **ride_requested:** Handled exclusively inside `_handleIncomingRide`.
* **duplicate handling:** Implemented and tested. A second event with the exact same `rideId` and `cycleId` is ignored safely, ensuring no duplicate BottomSheets.
* **active ride protection:** Implemented and tested. If `activeRideState != null`, any incoming request is completely discarded, relying on the backend state as authoritative.
* **invalid payload:** Implemented and tested. Missing `rideId` causes the event to be discarded safely without crashing the app.

## Accept

* **HTTP endpoint:** `POST /api/v1/drivers/rides/:id/accept` is explicitly called.
* **no automatic accept:** Receiving `ride_requested` does NOT trigger `acceptRide()`. Tested and verified.
* **backend authoritative state:** Captain relies on `fetchCurrentRide()` to reconcile state initially. After accepting, state is synced strictly from the Backend `RideModel` returned by the HTTP call.

## Tests

* **Exact command:** `flutter test`
* **Exact count:** 31 tests passed
* **Exact test files:**
  * `test/auth_provider_test.dart`
  * `test/location_service_test.dart`
  * `test/ride_synchronizer_test.dart`
  * `test/captain_provider_test.dart` (Modified: Added 5 WebSocket-specific unit tests covering payload validation, duplicates, active ride shielding, and no-auto-accept).
* **Backend command:** `npm run test`
* **Backend count:** 78 tests passed (0 skipped, 0 failed).

## Analyze

* Result: `No issues found! (ran in 7.8s)`
* Command: `flutter analyze`

## APK

* Result: `Built build\app\outputs\flutter-apk\app-debug.apk`
* Command: `flutter build apk --debug`

## Runtime

* Captain login: NOT EXECUTED
* DRIVER token: NOT EXECUTED
* WebSocket connect: NOT EXECUTED
* Captain online: NOT EXECUTED
* Passenger creates real ride: NOT EXECUTED
* Backend creates SEARCHING: NOT EXECUTED
* Redis dispatch: NOT EXECUTED
* Backend emits real `ride_requested`: NOT EXECUTED
* Captain receives it: NOT EXECUTED
* Incoming Ride UI appears: NOT EXECUTED
* Captain presses Accept: NOT EXECUTED
* Backend returns DRIVER_ASSIGNED: NOT EXECUTED

## Real E2E

* Passenger Flutter → Real Backend → Redis dispatch → Real WebSocket → Captain Flutter → incoming ride UI → Captain Accept → DRIVER_ASSIGNED = NOT EXECUTED

## Legacy scan

* Production code scanned for `DRIVER_ACCEPTED`, `OTP_VERIFIED`, `Requires OTP`, `fake ride`, `mock GPS`, `1500 MRU`.
* Results: 0 matches in production codebase.

## Blockers

* None. Implementation is robust and strictly mirrors the authoritative backend WebSocket contract.

## Final status

* Implementation: VERIFIED
* Source: VERIFIED
* Tests: VERIFIED
* Analyze: VERIFIED
* APK Build: VERIFIED
* Runtime: NOT EXECUTED
* Real E2E: NOT EXECUTED

**PHASE 7C.2 = NOT VERIFIED**
