# RIM WAY — API CONTRACT FREEZE

*Phase: 4C*
*Status: FROZEN*
*Date: 14 September 2026*

## CURRENT STATUS

- **Backend Core:** RUNTIME VERIFIED (PASS)
- **Swagger:** GENERATED & CONFIGURED (PASS)
- **OpenAPI:** EXPORTED (PASS)
- **API Documentation:** DOCUMENTED (PASS)
- **WebSocket Contract:** DOCUMENTED (PASS)
- **Regression:** TESTED (PASS)
- **Build:** SUCCESS (PASS)
- **Lint:** CLEAN (PASS)
- **Tests:** 23/23 PASSED (PASS)

---

## FREEZE RULES

By declaring this API Contract FROZEN, both the Backend and Flutter teams must strictly adhere to the following rules:

1. **Flutter must consume the frozen contract.** Flutter engineers cannot assume any undocumented behaviors, properties, or endpoints. The REST endpoints, WebSocket events, and JSON schemas specified in `API_CONTRACT.md` and `WEBSOCKET_CONTRACT.md` are the single source of truth.
2. **Backend endpoints must not change casually.** Modifying the request schemas, response schemas, or URL paths of the current `v1` endpoints is strictly prohibited unless authorized through a formal API change request.
3. **Breaking changes require versioning.** If a breaking change is absolutely necessary in the future, it must be introduced as `v2` (e.g. `/api/v2/rides/request`), leaving `v1` intact until Flutter completely migrates.
4. **New endpoints require documentation.** Any new features (e.g. Payments, Ratings) added to the backend must be immediately documented in the API Contract before Flutter integration begins.
5. **Changed response fields require explicit review.** Renaming a field (e.g. `estimatedFare` -> `fareEstimate`) is a breaking change and violates the freeze.
6. **WebSocket event names are part of the contract.** `ride_requested` and `ride_status_changed` are strict strings.
7. **Ride state names are part of the contract.** Flutter must explicitly handle the exact `RideStatus` strings (`SEARCHING`, `DRIVER_ASSIGNED`, `DRIVER_ARRIVED`, etc.). Do not invent states locally.
8. **Error semantics are part of the contract.** `409 Conflict` specifically dictates a `stateVersion` mismatch, race condition, or invalid OTP. Flutter must handle this exact status code properly.

---

## IMPLEMENTATION NOTES FOR FLUTTER

* **StateVersion:** Flutter must explicitly extract the `stateVersion` from ride responses and pass it into subsequent mutation requests.
* **Idempotency:** Flutter must generate a unique UUID for `Idempotency-Key` headers when retrying critical ride requests.
* **WebSocket Fallback:** Always rely on REST API responses for the ultimate truth, using WS events to prompt REST updates or UI state bumps.

## FINAL DECLARATION

**BACKEND CORE RUNTIME VERIFIED**
**API CONTRACT FROZEN**
**READY FOR FLUTTER INTEGRATION**
