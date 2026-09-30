# PHASE 7D EVIDENCE REPORT

## 1. Environment
* **Flutter**: `3.47.4 (channel stable, revision 9584c6713b)` (SOURCE VERIFIED)
* **Dart**: `3.13.3` (SOURCE VERIFIED)
* **Android SDK**: `36.1.0` (SOURCE VERIFIED via previous log)
* **Docker/Backend**: Postgres & Redis are running (SOURCE VERIFIED)
* **adb**: NOT FOUND. Runtime impossible in this environment. (NOT VERIFIED)

## 2. Repository Structure
* **Backend**: `C:\Users\Lenovo\Desktop\RIMWAY\rimway-backend` (SOURCE VERIFIED)
* **Flutter Apps (Combined)**: `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app` (SOURCE VERIFIED)
* **Legacy Apps**: `driver_app` and `passenger_app` are old folders and disconnected. (SOURCE VERIFIED)

## 3. Backend API Contract

| Method | Endpoint | Auth | Role | Controller | Service | DB effect | Tests | Status |
| ------ | -------- | ---- | ---- | ---------- | ------- | --------- | ----- | ------ |
| POST | /api/v1/auth/refresh | None | N/A | AuthController | AuthService | Rotates tokens | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/auth/logout | None | N/A | AuthController | AuthService | Invalidates tokens | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/auth/send-otp | None | N/A | AuthController | AuthService | None | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/auth/verify-otp | None | N/A | AuthController | AuthService | Creates Session | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/rides/estimate | None | N/A | RideController | RideService | None | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/rides/request | JWT | PASSENGER | RideController | RideService | Creates Ride | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/rides/cancel | JWT | PASSENGER | RideController | RideService | Cancels Ride | TEST VERIFIED | SOURCE VERIFIED |
| GET | /api/v1/rides/current | JWT | PASSENGER | RideController | RideService | Reads Ride | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/drivers/status | JWT | DRIVER | DriverController | DriverService | Updates Status | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/drivers/location | JWT | DRIVER | DriverController | DriverService | Redis GEO ADD | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/drivers/rides/:id/accept | JWT | DRIVER | DriverController | RideService | DRIVER_ASSIGNED | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/drivers/rides/:id/arrive | JWT | DRIVER | DriverController | RideService | DRIVER_ARRIVED | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/drivers/rides/:id/boarded | JWT | DRIVER | DriverController | RideService | PASSENGER_BOARDED | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/drivers/rides/:id/start | JWT | DRIVER | DriverController | RideService | IN_PROGRESS | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/drivers/rides/:id/complete | JWT | DRIVER | DriverController | RideService | COMPLETED, Wallet | TEST VERIFIED | SOURCE VERIFIED |
| POST | /api/v1/drivers/rides/:id/cancel | JWT | DRIVER | DriverController | RideService | CANCELLED_BY_DRIVER | TEST VERIFIED | SOURCE VERIFIED |
| GET | /api/v1/drivers/rides/current | JWT | DRIVER | DriverController | RideService | Reads Ride | TEST VERIFIED | SOURCE VERIFIED |
| ALL | /api/v1/admin/* | - | ADMIN | - | - | - | - | MISSING |

## 4. Ride State Machine
* **Lifecycle**: `SEARCHING` → `DRIVER_ASSIGNED` → `DRIVER_ARRIVED` → `PASSENGER_BOARDED` → `IN_PROGRESS` → `COMPLETED`. (SOURCE VERIFIED)
* **Passenger Cancel**: Allowed from `SEARCHING`, `DRIVER_ASSIGNED`, `DRIVER_ARRIVED`. (SOURCE VERIFIED)
* **Captain Cancel**: Allowed from `DRIVER_ASSIGNED`, `DRIVER_ARRIVED`. (SOURCE VERIFIED)
* **Admin Cancel**: `CANCELLED_BY_ADMIN` state exists in machine, but endpoints are MISSING.
* **Obsolete States**: `DRIVER_ACCEPTED` and `OTP_VERIFIED` completely removed. (SOURCE VERIFIED)

## 5. Concurrency
* `stateVersion` exists in Prisma schema. (SOURCE VERIFIED)
* Atomic `updateMany` with `where: { id: rideId, status: expectedStatus, stateVersion: expectedVersion }` and `data: { stateVersion: { increment: 1 } }` is correctly used in all transitions in `RideService`. (SOURCE VERIFIED)
* Failed concurrent transition throws `ConflictException` (409). (SOURCE VERIFIED)
* **No `read → modify → write` unsafe pattern found**. (SOURCE VERIFIED)

## 6. Passenger Audit
* **Auth**: OTP login, token management wired in `auth_provider.dart`. (SOURCE VERIFIED)
* **Ride**: Estimate, Request, Current, Cancel are all wired in `ride_provider.dart` and `ride_repository.dart`. (SOURCE VERIFIED)
* **Pricing**: Does NOT calculate authoritative fare locally. Backend is authoritative. (SOURCE VERIFIED)
* **State**: Utilizes the modern state machine via `RideSynchronizer`. No legacy states found. (SOURCE VERIFIED)

## 7. Captain Audit
* **Auth**: DRIVER role, access token, and secure storage in `auth_provider.dart`. (SOURCE VERIFIED)
* **Online Status/GPS**: Location updates via `CaptainProvider` to backend Redis. No fake/mocked GPS logic. (SOURCE VERIFIED)
* **WebSocket**: Connects to `driver_${driverId}`, processes `ride_requested`, deduplicates efficiently, ignores duplicate subscriptions. (SOURCE VERIFIED)
* **Automatic Accept**: Does NOT automatically accept. Requires explicit UI interaction. (SOURCE VERIFIED)
* **Final Fare**: `active_ride_panel.dart` strictly renders `finalFare` and gracefully falls back to "unavailable" (never to `estimatedFare`). (SOURCE VERIFIED)
* **OTP**: No ride-start OTP present. (SOURCE VERIFIED)

## 8. Admin Audit
* **Admin Role**: Present in `UserRole` enum.
* **Endpoints**: MISSING entirely.
* **Phone ride**: MISSING entirely.
* **Monitoring/Intervention**: MISSING entirely.

## 9. Dispatch
* **Variables**: `DISPATCH_INITIAL_RADIUS_KM`, `DISPATCH_TOP_N`, `DISPATCH_CYCLE_TTL_SEC`, `DISPATCH_FRESHNESS_SEC`, `DISPATCH_MAX_CYCLES`, `DISPATCH_RADIUS_EXPANSION_KM` are exactly implemented via `.env` defaults. (SOURCE VERIFIED)
* **Mechanisms**: GEOSEARCH, freshness exclusion, online exclusion, active ride exclusion, duplicate dispatch protection are fully present in `driver.service.ts` and `ride.service.ts`. (SOURCE VERIFIED)

## 10. WebSocket
* **Event Name**: `ride_requested` (SOURCE VERIFIED)
* **Room Name**: `driver_${driverId}` (SOURCE VERIFIED)
* **Payload Fields**: `rideId`, `cycleId`, `lat`, `lng`. (SOURCE VERIFIED)
* **Trace**: Redis Dispatch → `RideGateway` (`driver_${driverId}`) → Flutter `WsClient` → `CaptainProvider`. (SOURCE VERIFIED)
* Only authenticated DRIVER sockets receive requests. (SOURCE VERIFIED)

## 11. Pricing
* **Authoritative**: Backend calculates everything. (SOURCE VERIFIED)
* **Data Types**: Prisma `Decimal(10, 2)` strictly used. Zero `Float` or `Double` fields for money. (SOURCE VERIFIED)
* **Calculations**: `baseFare`, `minFare`, `perKm`, `perMinute` logic implemented cleanly in `PricingService`. (SOURCE VERIFIED)
* **Final vs Estimated**: Historically snapshotted strictly. (SOURCE VERIFIED)

## 12. Wallet / Commission
* **Data Types**: Decimal arithmetic exclusively used. (SOURCE VERIFIED)
* **Atomic Transaction**: State change + wallet settlement in a single Prisma transaction `tx`. (SOURCE VERIFIED)
* **Ledger**: Creates `RIDE_FARE` and `COMMISSION` with `rideId` and `driverId` linkage. (SOURCE VERIFIED)
* **Unique Protection**: `@@unique([rideId, type])` in Prisma ensures exact duplicate protection. (SOURCE VERIFIED)

## 13. Idempotency
* **Same Key**: Returns original ride. (SOURCE VERIFIED)
* **Schema**: `idempotencyKey` exists in `Ride`. (SOURCE VERIFIED)
* **payloadHash**: MISSING. Hash is not calculated/compared. `Idempotency` is only `PARTIAL`.

## 14. Database / Prisma
* **Entities**: Ride, Driver, User, Wallet, WalletTransaction, AuditLog, Pricing. (SOURCE VERIFIED)
* **Constraints**: `stateVersion` present, `@@unique([rideId, type])` present. (SOURCE VERIFIED)

## 15. Security
* **IDOR**: All endpoints exclusively extract IDs (`passengerId`, `driverId`, `userId`) from `req.user` payload. (SOURCE VERIFIED)
* **Guards**: `JwtAuthGuard` and `RolesGuard` applied. (SOURCE VERIFIED)

## 16. Localization
* App leverages `app_localizations.dart` for AR, FR, EN.
* No hardcoded arabic strings detected in the audited UI panels. (SOURCE VERIFIED)

## 17. Tests
* **Flutter tests**: 31 passed. (TEST VERIFIED)
* **Backend tests**: 78 passed. (TEST VERIFIED)

## 18. Analyze / Build
* **Analyze**: 0 issues. (BUILD VERIFIED)
* **APK**: Built successfully. (BUILD VERIFIED)

## 19. Legacy Scan
* `DRIVER_ACCEPTED`: 0 matches
* `OTP_VERIFIED`: 0 matches
* `Requires OTP`: 0 matches
* `fake ride` / `mock GPS`: 0 matches
* `1500 MRU` / `Float` / `Double`: 0 matches for production money values. (SOURCE VERIFIED)

## 20. Runtime
* **Runtime**: NOT EXECUTED (Environmental limitation)

## 21. Real E2E
* **Real E2E**: NOT EXECUTED (Environmental limitation)

## 22. Cross-Client Contract Matrix

| Capability | Backend | Passenger | Captain | Admin | Automated Tests | Runtime |
| --- | --- | --- | --- | --- | --- | --- |
| Login | SOURCE | SOURCE | SOURCE | MISSING | TEST VERIFIED | NOT EXECUTED |
| Refresh | SOURCE | SOURCE | SOURCE | MISSING | TEST VERIFIED | NOT EXECUTED |
| Passenger ride request | SOURCE | SOURCE | N/A | N/A | TEST VERIFIED | NOT EXECUTED |
| Phone ride | MISSING | N/A | N/A | MISSING | MISSING | NOT EXECUTED |
| Fare estimate | SOURCE | SOURCE | N/A | MISSING | TEST VERIFIED | NOT EXECUTED |
| Redis dispatch | SOURCE | N/A | N/A | N/A | TEST VERIFIED | NOT EXECUTED |
| WebSocket ride_requested | SOURCE | N/A | SOURCE | N/A | TEST VERIFIED | NOT EXECUTED |
| Captain Accept | SOURCE | N/A | SOURCE | N/A | TEST VERIFIED | NOT EXECUTED |
| Arrive/Board/Start/Complete | SOURCE | N/A | SOURCE | N/A | TEST VERIFIED | NOT EXECUTED |
| Passenger Cancel | SOURCE | SOURCE | N/A | N/A | TEST VERIFIED | NOT EXECUTED |
| Captain Cancel | SOURCE | N/A | SOURCE | N/A | TEST VERIFIED | NOT EXECUTED |
| Admin Cancel | MISSING | N/A | N/A | MISSING | MISSING | NOT EXECUTED |
| Current ride | SOURCE | SOURCE | SOURCE | N/A | TEST VERIFIED | NOT EXECUTED |
| Final fare | SOURCE | PARTIAL | SOURCE | N/A | TEST VERIFIED | NOT EXECUTED |
| Wallet settlement | SOURCE | N/A | N/A | MISSING | TEST VERIFIED | NOT EXECUTED |
| Commission | SOURCE | N/A | N/A | MISSING | TEST VERIFIED | NOT EXECUTED |
| AuditLog | SOURCE | N/A | N/A | MISSING | TEST VERIFIED | NOT EXECUTED |

## 23. Critical Gaps
* **P0 — Critical risk**: Runtime/Real E2E is completely unexecuted. We cannot definitively guarantee the system behaves correctly on devices.
* **P1 — Major missing capability**: Admin Module (API, UI, Phone Rides, Monitoring) is entirely MISSING.
* **P2 — Important integration issue**: `payloadHash` validation for strict idempotency checking is MISSING.

## 24. Recommended Next Phase
1. Physical device manual testing by QA team (since AI runtime execution is blocked).
2. Implementation of the `Admin` backend and frontend modules (Phone Rides, Moderation, Monitoring).
3. Implementation of `payloadHash` in `RequestRideDto` for perfect idempotency.

## 25. Exact Final Status
**PHASE 7D = AUDIT COMPLETE**

* Source: VERIFIED
* Tests: VERIFIED
* Build: VERIFIED
* Runtime: NOT EXECUTED
* Real E2E: NOT EXECUTED
