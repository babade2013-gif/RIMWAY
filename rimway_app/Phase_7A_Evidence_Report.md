# PHASE 7A EVIDENCE REPORT

## 1. Files changed
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\pubspec.yaml`
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\android\app\src\main\AndroidManifest.xml`
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\lib\features\captain\application\captain_provider.dart`
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\lib\features\ride\application\ride_provider.dart`
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\lib\core\localization\app_localizations.dart`
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\lib\features\auth\presentation\otp_screen.dart`
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\lib\features\captain\presentation\widgets\captain_drawer.dart`
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\lib\features\captain\presentation\widgets\active_ride_panel.dart`
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\lib\features\captain\presentation\widgets\incoming_ride_bottom_sheet.dart`
- `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app\test\location_service_test.dart`

## 2. GPS implementation
- **Package used**: `geolocator: ^13.0.0`
- **Permission behavior**: `GeolocatorPlatform.instance.requestPermission()` is called. If denied, throws `ApiException` with message `location_permission_denied`. If denied permanently, throws `location_permission_permanently_denied`. 
- **Service-disabled behavior**: Checked via `isLocationServiceEnabled()`. If disabled, throws `ApiException` with message `location_service_disabled`.
- **Coordinate source**: Hardware real GPS coordinates via `geolocator.getCurrentPosition()`. Fake generation and Nouakchott defaults were entirely avoided.
- **Error handling**: `ApiException` surfaced through `CaptainProvider._errorMessage`. Failed GPS drops Captain `_isOnline` to `false` automatically.

## 3. Backend location mapping
- **Endpoint**: `POST /api/v1/drivers/location`
- **DTO**: Expects `{ lat: number, lng: number }` (Mapped via `captain_repository.dart` natively).
- **Repository method**: `repository.updateLocation(lat, lng)`.
- **Exact fields**: `{'lat': position.latitude, 'lng': position.longitude}` sent exactly matching DTO.

## 4. Simulation removal
- **Files changed**: `incoming_ride_bottom_sheet.dart`
- **Fake UI removed**: Yes, removed the `New Request (Simulated)` text and hardcoded rows.
- **Hardcoded fare removed**: Yes, removed the `1500 MRU` fake value.
- **Fake rides removed**: Replaced with `context.tr('no_incoming_rides')` (No incoming rides).

## 5. OTP cleanup
- **Ride-start OTP references removed**: Yes. Removed `START RIDE (Requires OTP)` string in `active_ride_panel.dart`. Removed `dev_otp_notice` from localizations and UI (Drawer, Login screen).
- **Authentication OTP preserved**: Yes, `verifyOtp` logic in auth provider untouched.

## 6. DRIVER_ACCEPTED cleanup
- **Exact remaining matches**: 0 (zero) matches remaining in `lib/`.
- **Classification**: OBSOLETE. Fully removed from `RideProvider.dart` switch statement.

## 7. Localization
- **Keys changed**: 
  - `dev_otp_notice` -> REMOVED.
  - `no_incoming_rides` -> ADDED (ar, fr, en).

## 8. Tests
- **Exact count**: 20 tests.
- **Passed**: 20 passed.
- **Failed**: 0 failed.

## 9. flutter analyze
PASS (0 issues found, ran in 12.0s).

## 10. Backend changes
NONE. `npm run test` confirms 68 passed tests.

## 11. Remaining blockers
- Captain UI still lacks full integration with the rest of the backend REST endpoints (`/accept`, `/start`, `/arrive`, `/complete`), which are deferred to PHASE 7B.
- Captain Map layer uses a grey grid placeholder instead of a real map (e.g., Google Maps integration).

## 12. Status

PHASE 7A = VERIFIED
