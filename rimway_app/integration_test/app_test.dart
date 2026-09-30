import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:rimway_app/main.dart' as app;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:dio/dio.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // The local backend URL (used by driver script)
  const String backendUrl = 'http://10.0.2.2:3000';
  final Dio driverDio = Dio(BaseOptions(baseUrl: '$backendUrl/api/v1'));
  String? driverToken;
  String? currentRideId;

  // Helper: Login as Driver
  Future<void> driverLogin() async {
    final res = await driverDio.post('/drivers/login', data: {
      'phone': '30000000',
      'otp': '1234'
    });
    driverToken = res.data['access_token'];
    driverDio.options.headers['Authorization'] = 'Bearer $driverToken';
    // Ensure online
    await driverDio.post('/drivers/online');
  }

  // Helper: Poll for new ride and assign
  Future<void> driverAssignRide() async {
    for (int i = 0; i < 10; i++) {
      final res = await driverDio.get('/drivers/rides');
      final rides = res.data as List;
      if (rides.isNotEmpty) {
        currentRideId = rides.first['id'];
        await driverDio.post('/drivers/rides/$currentRideId/assign');
        return;
      }
      await Future.delayed(const Duration(seconds: 1));
    }
    throw Exception('Driver did not find any pending rides');
  }

  // Helper: Arrive
  Future<void> driverArrive() async {
    await driverDio.post('/drivers/rides/$currentRideId/arrive');
  }

  // Helper: Start
  Future<void> driverStart() async {
    await driverDio.post('/drivers/rides/$currentRideId/start');
  }

  // Helper: Complete
  Future<void> driverComplete() async {
    await driverDio.post('/drivers/rides/$currentRideId/complete');
  }

  setUpAll(() async {
    // Clear storage to ensure fresh login
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  });

  testWidgets('Phase 5B.3 - End-to-End Passenger Flow', (WidgetTester tester) async {
    // 1. Launch App
    app.main();
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // Wait for Splash screen to route
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // 2. Login Flow
    // Enter Phone
    final phoneField = find.byType(TextField).first;
    await tester.enterText(phoneField, '40000000');
    await tester.pumpAndSettle();

    final sendOtpBtn = find.text('Send Verification Code');
    await tester.tap(sendOtpBtn);
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // Enter OTP
    final otpField = find.byType(TextField).first;
    await tester.enterText(otpField, '1234');
    await tester.pumpAndSettle();

    final verifyBtn = find.text('Verify');
    await tester.tap(verifyBtn);
    await tester.pumpAndSettle(const Duration(seconds: 3));

    // 3. Home Screen & Destination
    expect(find.text('RIM WAY'), findsOneWidget); // Brand check

    final destField = find.widgetWithText(TextField, 'Enter destination');
    await tester.enterText(destField, 'Test Destination 123');
    await tester.pumpAndSettle();

    // 4. Estimate Fare
    final estimateBtn = find.text('Estimate Fare');
    await tester.tap(estimateBtn);
    await tester.pumpAndSettle(const Duration(seconds: 2));

    expect(find.textContaining('Estimated fare'), findsWidgets);

    // 5. Request Ride
    final requestBtn = find.text('Request Ride');
    await tester.tap(requestBtn);
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // 6. Searching State
    expect(find.text('Finding a driver...'), findsOneWidget);

    // ---- DRIVER ACTIONS ----
    await driverLogin();
    await driverAssignRide();

    // 7. Driver Assigned
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Driver is on the way'), findsOneWidget);

    // 8. Driver Arrived
    await driverArrive();
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Driver has arrived. Please meet them.'), findsOneWidget);

    // 9. Ride Active
    await driverStart();
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Ride active'), findsOneWidget);

    // 10. Ride Completed
    await driverComplete();
    await tester.pumpAndSettle(const Duration(seconds: 2));
    expect(find.text('Ride Completed ✓'), findsOneWidget);

    final doneBtn = find.text('Done');
    await tester.tap(doneBtn);
    await tester.pumpAndSettle(const Duration(seconds: 2));

    // Back to Home
    expect(find.text('Enter destination'), findsOneWidget);
  });
}
