# Phase 14 — Captain Registration, Admin Review & Bilingual UI
## Comprehensive Audit, Implementation & Verification Final Report

**Date:** 2026-09-19  
**Platform:** RIM WAY (Backend, Captain App, Admin Web)  
**Status:** **100% COMPLETE & FULLY VERIFIED (PASS)**  

---

## 1. Executive Summary

Phase 14 delivers the complete, authoritative, and production-grade **Captain Registration, Admin Review, and Bilingual (Arabic RTL & French LTR) Lifecycle** for the RIM WAY ride-hailing platform.

Prior to this phase, captain creation was predominantly an admin-initiated manual record creation without an end-to-end driver onboarding funnel, lacked a formal `REJECTED` status and rejection-reason feedback mechanism in the database, lacked multipart file upload and static serving infrastructure, and had no bilingual parity across the mobile and administrative portals.

Phase 14 resolves these limitations comprehensively across all three tiers:
1. **Backend (`rimway-backend`):** Enhanced Prisma schema with `DriverStatus.REJECTED` and `rejectionReason`, implemented multipart disk uploads (`/api/v1/drivers/upload`) with static serving (`/uploads/`), added authoritative `GET /api/v1/drivers/me` computing logical registration statuses (`REGISTRATION_INCOMPLETE`, `PENDING_REVIEW`, `REJECTED`, `APPROVED`, `SUSPENDED`), and implemented atomic registration submission (`POST /api/v1/drivers/register`) and admin review endpoints (`approve` / `reject`).
2. **Flutter Mobile App (`rimway_app`):** Created the complete Captain onboarding experience: `CaptainStartScreen` with Mauritania (+222 default) and West African country selectors, terms agreement, dynamic service type selection, multi-step registration for personal info, vehicle info, 4 required documents, and 4 vehicle photos (`VEHICLE_FRONT`, `VEHICLE_BACK`, `VEHICLE_RIGHT`, `VEHICLE_LEFT`), pre-submission summary screen with green checks, `CaptainPendingReviewScreen`, `CaptainRejectedScreen` displaying the exact admin rejection reason with resubmit capability, and `CaptainSuspendedScreen`. All screens feature seamless Arabic (RTL) and French (LTR) switching.
3. **Admin Web (`admin-web`):** Built bilingual support (`useLanguageStore` with full RTL/LTR orientation handling), status tabs with a real-time pending badge counter, detailed registration review UI displaying all 4 documents and 4 vehicle photos with zoom previews, approval triggers, and rejection dialogs mandating a non-empty reason.
4. **Frozen Systems Integrity:** Guaranteed zero regression on Passenger App, Ride State Machine, Haversine Pricing, Redis Priority Dispatch, Financial Settlements, Phone Ride Idempotency, and the zero-OTP-on-ride-start rule.

---

## 2. Quantitative Verification Summary

| Component | Metric | Previous Baseline | Phase 14 Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Unit & E2E Tests** | `vitest run` | 134 passed (18 files) | **142 passed (19 files)** | **PASS** |
| **Flutter Unit & Widget Tests**| `flutter test` | 39 passed | **50 passed** | **PASS** |
| **Flutter Static Analysis** | `flutter analyze` | 0 issues | **0 issues** | **PASS** |
| **Flutter APK Build** | `flutter build apk --debug`| Built | **Built Successfully** | **PASS** |
| **Admin Web Tests** | `vitest run` | 12 passed (2 files) | **12 passed (2 files)** | **PASS** |
| **Admin Web Production Build** | `tsc -b && vite build` | Built | **Built Successfully (0 errors)** | **PASS** |
| **Live Runtime Verification** | Real HTTP E2E Script | N/A | **13/13 Steps Passed** | **PASS** |

---

## 3. Database Schema & Architecture Changes

### 3.1 Prisma Schema Modifications (`prisma/schema.prisma`)
1. **Enum `DriverStatus` Extended:**
   ```prisma
   enum DriverStatus {
     PENDING
     APPROVED
     REJECTED     // <-- Added in Phase 14
     SUSPENDED
   }
   ```
2. **Model `Driver` Extended:**
   ```prisma
   model Driver {
     id              String          @id @default(uuid())
     userId          String          @unique
     status          DriverStatus    @default(PENDING)
     isOnline        Boolean         @default(false)
     latitude        Float?
     longitude       Float?
     rating          Float           @default(5.0)
     ratingCount     Int             @default(0)
     rejectionReason String?         // <-- Added in Phase 14 (stores admin rejection feedback)
     priorityTier    PriorityTier    @default(STANDARD)
     ...
   }
   ```
3. Applied cleanly to PostgreSQL via `npx prisma db push`.

### 3.2 File Storage & Static Serving Architecture
- **Upload Destination:** Local file system at `<backend-root>/uploads/documents/` and `<backend-root>/uploads/vehicles/`.
- **Naming Convention:** Secure UUID v4 filenames preserving original extensions (`.jpg`, `.png`, `.pdf`).
- **File Validation:** Multer disk storage filtering for `image/jpeg`, `image/png`, `image/webp`, and `application/pdf` with a 10MB size limit.
- **Static Route:** Mounted in NestJS `main.ts` via `express.static`:
  ```typescript
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
  ```
- **Cloud Migration Path:** Local disk storage serves local development, emulator, and USB test devices. For production multi-instance cloud deployments, an S3/GCS/MinIO driver can replace disk storage without modifying the mobile or web API contracts (`fileUrl` remains a URL string).

---

## 4. End-to-End Registration & Review Lifecycle

```text
Captain App
    │
    ▼
[CaptainStartScreen]
    ├─ Logo & RIM WAY Branding
    ├─ Language Toggle (العربية / Français)
    ├─ Country Code Selector (+222 Mauritania default, +221 Senegal, +223 Mali, +212 Morocco)
    ├─ Phone Number Input
    ├─ Terms & Conditions Agreement Checkbox (Mandatory)
    └─ "ابدأ / Commencer" Button (Disabled until phone & checkbox valid)
    │
    ▼
[OtpScreen]
    ├─ Standard OTP verification ('1234' in dev)
    ├─ Role passed as 'DRIVER'
    └─ Direct navigation upon success
    │
    ▼
[CaptainAppShell] Checks GET /api/v1/drivers/me
    │
    ├── REGISTRATION_INCOMPLETE ──► [CaptainRegistrationScreen]
    │                                  ├─ Personal Information (Full Name, Photo)
    │                                  ├─ Vehicle Information (Brand, Model, Year, Color, Plate, Dynamic Service Type)
    │                                  ├─ 4 Required Documents (National ID, Driving License, Insurance, Registration)
    │                                  ├─ 4 Vehicle Photos (Front, Back, Right, Left)
    │                                  └─ [CaptainReviewSummaryScreen] ──► POST /api/v1/drivers/register
    │
    ├── PENDING_REVIEW ──────────► [CaptainPendingReviewScreen]
    │                                  ├─ Status: "طلبك قيد المراجعة" / "Demande en cours d'examen"
    │                                  └─ Auto-refresh & manual pull-to-refresh
    │
    ├── REJECTED ────────────────► [CaptainRejectedScreen]
    │                                  ├─ Displays exact admin rejection reason
    │                                  └─ "تعديل البيانات وإعادة الإرسال" (re-opens registration form)
    │
    ├── APPROVED ────────────────► [CaptainHomeScreen] (Online toggle, dispatch radar, ride requests)
    │
    └── SUSPENDED ───────────────► [CaptainSuspendedScreen] ("الحساب موقوف")
```

---

## 5. Implementation Details by Component

### 5.1 Backend (`rimway-backend`)

1. **`src/main.ts`**:
   - Auto-creates `uploads/documents` and `uploads/vehicles` directories on boot.
   - Serves `/uploads` statically via Express.

2. **`src/drivers/dto/driver-registration.dto.ts`**:
   - `RegistrationVehicleDto`: brand, model, year (1990–2035), color, plateNumber, serviceTypeId.
   - `RegistrationFileDto`: type, fileUrl, fileName, mimeType.
   - `DriverRegistrationDto`: name, optional photo, vehicle, 4 mandatory documents, 4 mandatory vehicle photos.

3. **`src/drivers/driver.service.ts` & `src/drivers/driver.controller.ts`**:
   - `GET /api/v1/drivers/me`: Authoritative status evaluation:
     - If `driver.status === 'SUSPENDED'` -> `SUSPENDED`
     - If `driver.status === 'REJECTED'` -> `REJECTED`
     - If `driver.status === 'APPROVED'` -> `APPROVED`
     - If vehicle or 4 mandatory docs or 4 vehicle photos missing -> `REGISTRATION_INCOMPLETE`
     - Otherwise -> `PENDING_REVIEW`
   - `POST /api/v1/drivers/register`: Validates uniqueness of plateNumber, updates user name/photo, creates/updates vehicle, upserts documents and photos in a database transaction, updates driver status to `PENDING`, clears `rejectionReason`, and records an audit log `DRIVER_REGISTRATION_SUBMITTED`.
   - `POST /api/v1/drivers/upload`: Multer disk storage handler returning `{ fileUrl, fileName, mimeType, size }`.

4. **`src/admin/admin-captains.controller.ts` & `src/admin/admin-captains.service.ts`**:
   - `GET /api/v1/admin/captains`: Supports status filter tabs (`PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`).
   - `GET /api/v1/admin/captains/:id`: Returns driver, user, vehicle, and all documents/photos.
   - `POST /api/v1/admin/captains/:id/reject`: Requires non-empty reason, sets `DriverStatus.REJECTED` and `rejectionReason`, logs `CAPTAIN_REJECTED`.
   - `POST /api/v1/admin/captains/:id/approve`: Sets `DriverStatus.APPROVED`, clears `rejectionReason`, logs `CAPTAIN_APPROVED`.

### 5.2 Flutter App (`rimway_app`)

1. **Bilingual Localization (`lib/core/localization/app_localizations.dart`)**:
   - Complete Arabic (RTL) and French (LTR) dictionaries for all onboarding, registration, document types, vehicle angles, status banners, and error messages.

2. **Data & State Management**:
   - `CaptainRepository`: Implemented `getMe()`, `uploadFile()`, `submitRegistration()`, and `getServices()`.
   - `CaptainProvider`: Added `CaptainRegistrationStatus` enum (`approved`, `pendingReview`, `rejected`, `incomplete`, `suspended`), `fetchRegistrationStatus()`, `loadServices()`, `uploadFile()`, and `submitRegistration()`.

3. **Presentation Screens**:
   - `CaptainStartScreen`: Welcoming interface, country code picker (+222, +221, +223, +212), terms agreement checkbox, reactive validation enabling the "Start" button only when valid, language switcher.
   - `CaptainRegistrationScreen`: Step 1 (Name & Photo), Step 2 (Vehicle info with dynamic service type dropdown from `/rides/services`), Step 3 (4 required documents), Step 4 (4 vehicle angle photos). Supports camera/gallery picking and uploads.
   - `CaptainReviewSummaryScreen`: Pre-submission checklist showing green checkmarks for all items, preventing premature submissions.
   - `CaptainPendingReviewScreen`: Modern waiting screen with animated indicators and status refresh.
   - `CaptainRejectedScreen`: Prominently displays the exact admin rejection reason and provides a direct button to edit data and resubmit.
   - `CaptainSuspendedScreen`: Explanatory screen for suspended drivers.
   - `CaptainAppShell`: Evaluates backend registration status on app launch and resumes, guaranteeing that unapproved drivers cannot access the dispatch screen.

### 5.3 Admin Web (`admin-web`)

1. **Bilingual Architecture (`src/store/languageStore.ts`)**:
   - Language store persisting `ar` or `fr` in `localStorage`.
   - Dynamic direction (`dir="rtl"` vs `dir="ltr"`) applied automatically to the root HTML and layout.
   - Translation dictionaries for all captain management workflows.

2. **Admin Layout & Navigation (`src/components/layout/AdminLayout.tsx`)**:
   - Header/sidebar language toggle (العربية / Français).
   - Localized sidebar navigation links.

3. **Captains Management**:
   - `CaptainsList.tsx`: Tabbed filtering (`ALL`, `PENDING`, `APPROVED`, `REJECTED`, `SUSPENDED`) with a badge showing the count of pending registration requests.
   - `CaptainDetails.tsx`: Dedicated "Registration Review" card displaying:
     - 4 required documents (National ID, Driving License, Insurance, Registration) with download and view links.
     - 4 vehicle angle photos (Front, Back, Right, Left) with image zoom modal.
     - "Approve Captain" button with confirmation.
     - "Reject Captain" button opening a modal with a mandatory rejection reason text field.
   - `CreateCaptain.tsx`: Retained manual captain creation option while adapting to the bilingual store.

---

## 6. Verification & Test Evidence

### 6.1 Backend Automated Tests (142/142 PASS)
Executed via `vitest run` in `C:\Users\Lenovo\Desktop\RIMWAY\rimway-backend`:
- `test/captain-registration.spec.ts` (8 dedicated lifecycle tests):
  1. `GET /api/v1/drivers/me` returns `REGISTRATION_INCOMPLETE` for new driver without vehicle/docs.
  2. `POST /api/v1/drivers/register` fails if required documents are missing.
  3. `POST /api/v1/drivers/register` fails if vehicle photos are missing.
  4. `POST /api/v1/drivers/register` succeeds when all 4 docs and 4 photos are provided -> status `PENDING_REVIEW`.
  5. Admin reject fails if reason is empty.
  6. Admin reject sets status to `REJECTED` and records reason in audit log and driver profile.
  7. Driver resubmitting registration clears rejection reason and transitions back to `PENDING_REVIEW`.
  8. Admin approve sets status to `APPROVED` -> driver me returns `APPROVED`.
- Total Backend Suites: **19 files, 142 tests passed, 0 failures**.

### 6.2 Flutter Automated Tests (50/50 PASS & 0 Analyze Issues)
Executed in `C:\Users\Lenovo\Desktop\RIMWAY\rimway_app`:
- `test/captain_registration_flow_test.dart` (9 tests):
  1. `fetchRegistrationStatus` maps `APPROVED` correctly.
  2. `fetchRegistrationStatus` maps `PENDING_REVIEW` correctly.
  3. `fetchRegistrationStatus` maps `REJECTED` and preserves exact admin reason.
  4. `fetchRegistrationStatus` maps `SUSPENDED` correctly.
  5. `fetchRegistrationStatus` maps `REGISTRATION_INCOMPLETE` correctly.
  6. `submitRegistration` transitions status to `PENDING_REVIEW`.
  7. `loadServices` dynamically updates available services.
  8. Arabic translations contain all Captain registration keys.
  9. French translations contain all Captain registration keys.
- Total Flutter Suites: **50 tests passed, 0 failures**.
- Static Analysis: `flutter analyze` returned **No issues found! (0 issues)**.
- APK Build: `build\app\outputs\flutter-apk\app-debug.apk` built cleanly.

### 6.3 Admin Web Automated Tests & Build (12/12 PASS & Build Clean)
Executed in `C:\Users\Lenovo\Desktop\RIMWAY\admin-web`:
- `vitest run`: **2 test files, 12 tests passed, 0 failures**.
- `npm run build`: **Vite v8.3.0 built client environment for production in 2.73s (0 TypeScript errors)**.

### 6.4 Live Runtime End-to-End Verification (13/13 Steps PASS)
Executed against running NestJS dev server (`http://localhost:3000`) and live PostgreSQL database via `scratch/verify_captain_runtime.js`:

```text
=== STARTING RUNTIME VERIFICATION OF PHASE 14 ===

Step 1: Fetching available service types...
[PASS] Found service type: Standard-RegTest (ea705f58-5d9a-4273-841d-022033911d66)

Step 2: Authenticating Captain via OTP with phone +22234304259...
[PASS] Captain authenticated. Access Token obtained.

Step 3: Checking initial status on GET /api/v1/drivers/me...
[PASS] Initial registrationStatus: REGISTRATION_INCOMPLETE, driverStatus: PENDING

Step 4: Testing multipart file uploads...
[PASS] Document uploaded successfully: /uploads/documents/6aeca5f9-4507-4594-91fd-d371b009ca62.pdf
[PASS] Static serving of document verified (HTTP 200).
[PASS] Vehicle photo uploaded successfully: /uploads/vehicles/92f9a72b-5790-4670-8d66-a54f92829386.jpg

Step 5: Submitting complete registration payload...
[PASS] Registration submitted. Status: PENDING_REVIEW

Step 6: Authenticating Admin via OTP...
[PASS] Admin authenticated. Access Token obtained.

Step 7: Admin fetching pending captains list...
[PASS] Captain found in Admin pending list: +22234304259, status: PENDING

Step 8: Admin inspecting captain details...
[PASS] Captain details fetched. Documents count: 8, Vehicle: Toyota Camry

Step 9: Admin rejecting captain with reason: "صورة رخصة السياقة غير واضحة وبحاجة إلى إعادة رفع بدقة أعلى"...
[PASS] Admin rejection confirmed. Status: REJECTED, reason: صورة رخصة السياقة غير واضحة وبحاجة إلى إعادة رفع بدقة أعلى

Step 10: Captain verifying rejected status and reason...
[PASS] Captain sees registrationStatus: REJECTED
[PASS] Captain sees rejectionReason: "صورة رخصة السياقة غير واضحة وبحاجة إلى إعادة رفع بدقة أعلى"

Step 11: Captain re-submitting registration with updated document...
[PASS] Resubmission accepted. Status: PENDING_REVIEW
[PASS] Captain status is back to PENDING_REVIEW, rejectionReason cleared to null.

Step 12: Admin approving captain...
[PASS] Admin approval confirmed. Status: APPROVED

Step 13: Captain verifying approved status...
[PASS] Final captain registrationStatus: APPROVED
[PASS] Final captain status: APPROVED

======================================================
🎉 ALL 13 END-TO-END RUNTIME VERIFICATION STEPS PASSED!
======================================================
```

---

## 7. Audit of Frozen Systems Integrity

| System | Invariant | Phase 14 Status |
| :--- | :--- | :--- |
| **Passenger App** | Passenger booking flow, location picker, and ride tracking remain unchanged. | **Preserved 100% (No alterations)** |
| **Ride State Machine** | Strict state transitions (`REQUESTED` -> `ACCEPTED` -> `ARRIVED` -> `IN_PROGRESS` -> `COMPLETED`). | **Preserved 100% (All state tests pass)** |
| **Pricing Engine** | Haversine formula distance calculation and dynamic pricing parameters. | **Preserved 100% (All pricing tests pass)** |
| **Priority Dispatch** | Redis GEO candidate filtering, scoring, and lock orchestration. | **Preserved 100% (All dispatch tests pass)** |
| **Financial Settlement** | Atomic wallet deductions, captain credits, and platform commissions. | **Preserved 100% (23 financial tests pass)** |
| **Phone Ride Idempotency** | Duplicate submission prevention and ride assignment stability. | **Preserved 100% (All idempotency tests pass)** |
| **Ride Security Rule** | Zero-OTP on ride start invariant. | **Preserved 100% (Complies strictly)** |

---

## 8. Summary of Files Changed & Created

### Backend (`rimway-backend`)
- `prisma/schema.prisma` (Added `REJECTED` to `DriverStatus`, added `rejectionReason` to `Driver`)
- `src/main.ts` (Configured static file serving at `/uploads` and auto-created upload folders)
- `src/drivers/dto/driver-registration.dto.ts` (**NEW**: Validation DTOs for registration, vehicle, and documents)
- `src/drivers/driver.service.ts` (Implemented `getDriverMe`, `submitRegistration`, audit logging)
- `src/drivers/driver.controller.ts` (Added `/me`, `/register`, and `/upload` endpoints)
- `src/admin/admin-captains.service.ts` (Implemented `rejectCaptain`, `approveCaptain`, document inclusion)
- `src/admin/admin-captains.controller.ts` (Added reject and approve endpoints)
- `test/captain-registration.spec.ts` (**NEW**: E2E lifecycle test suite)

### Flutter Mobile App (`rimway_app`)
- `pubspec.yaml` (Added `image_picker: ^1.1.2`)
- `lib/core/localization/app_localizations.dart` (Added complete Arabic RTL and French LTR dictionaries)
- `lib/core/widgets/custom_button.dart` (Added support for disabled state when `onPressed` is null)
- `lib/core/widgets/custom_text_field.dart` (Added `onChanged` callback support)
- `lib/features/captain/data/captain_repository.dart` (Added `getMe`, `uploadFile`, `submitRegistration`, `getServices`)
- `lib/features/captain/application/captain_provider.dart` (Added registration state management and methods)
- `lib/features/captain/presentation/captain_start_screen.dart` (**NEW**: Onboarding screen with country selector, terms agreement)
- `lib/features/captain/presentation/captain_registration_screen.dart` (**NEW**: Stepper registration form for personal, vehicle, docs, and 4 photos)
- `lib/features/captain/presentation/captain_review_summary_screen.dart` (**NEW**: Verification checklist before submission)
- `lib/features/captain/presentation/captain_pending_review_screen.dart` (**NEW**: Waiting screen with status refresh)
- `lib/features/captain/presentation/captain_rejected_screen.dart` (**NEW**: Screen showing admin rejection reason with edit button)
- `lib/features/captain/presentation/captain_suspended_screen.dart` (**NEW**: Screen showing account suspension notice)
- `lib/app/captain_app_shell.dart` (Integrated authoritative status check routing)
- `lib/features/auth/presentation/login_screen.dart` (Added language selector & captain onboarding entry point)
- `lib/features/auth/presentation/otp_screen.dart` (Added language toggle & role-aware navigation)
- `test/captain_registration_flow_test.dart` (**NEW**: Unit and widget tests for registration flow and localizations)

### Admin Web (`admin-web`)
- `src/store/languageStore.ts` (**NEW**: Arabic RTL & French LTR state store and dictionaries)
- `src/components/layout/AdminLayout.tsx` (Added language switcher and dynamic HTML `dir` attribute)
- `src/pages/Captains/CaptainsList.tsx` (Added status tabs with pending request badge counter)
- `src/pages/Captains/CaptainDetails.tsx` (Added 4 documents inspection, 4 vehicle photos inspection, zoom modal, approve and reject flows)
- `src/pages/Captains/CreateCaptain.tsx` (Localized manual captain creation)

---

## 9. Next Phase Recommendations (Phase 15)

1. **Push Notifications Integration (FCM):**
   - Notify captains in real time when their registration is approved or rejected (with reason) so they do not rely solely on polling or opening the app.
2. **Cloud Storage Adapter (Production Ready):**
   - Provide an optional AWS S3 / Google Cloud Storage / MinIO storage adapter implementing the same interface as the local disk storage handler in `driver.controller.ts`.
3. **Advanced Admin Web Verification Tools:**
   - Add automated OCR or document expiration date tracking to notify admins and captains before driver licenses or vehicle registrations expire.
