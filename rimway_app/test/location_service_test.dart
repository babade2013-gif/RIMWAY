import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:geolocator/geolocator.dart';
import 'package:rimway_app/features/captain/application/captain_provider.dart';
import 'package:rimway_app/core/errors/api_exception.dart';

class MockGeolocatorPlatform extends Mock implements GeolocatorPlatform {}

void main() {
  late MockGeolocatorPlatform mockGeolocator;
  late LocationService locationService;

  setUp(() {
    mockGeolocator = MockGeolocatorPlatform();
    locationService = LocationService(geolocator: mockGeolocator);
  });

  group('LocationService Tests', () {
    test('throws GPS_ERROR when location service is disabled', () async {
      when(() => mockGeolocator.isLocationServiceEnabled()).thenAnswer((_) async => false);

      await expectLater(
        locationService.getCurrentLocation(),
        throwsA(isA<ApiException>()
            .having((e) => e.errorType, 'errorType', 'GPS_ERROR')
            .having((e) => e.message, 'message', 'location_service_disabled')),
      );
    });

    test('requests permission and throws GPS_ERROR when permission is denied', () async {
      when(() => mockGeolocator.isLocationServiceEnabled()).thenAnswer((_) async => true);
      when(() => mockGeolocator.checkPermission()).thenAnswer((_) async => LocationPermission.denied);
      when(() => mockGeolocator.requestPermission()).thenAnswer((_) async => LocationPermission.denied);

      await expectLater(
        locationService.getCurrentLocation(),
        throwsA(isA<ApiException>()
            .having((e) => e.errorType, 'errorType', 'GPS_ERROR')
            .having((e) => e.message, 'message', 'location_permission_denied')),
      );

      verify(() => mockGeolocator.requestPermission()).called(1);
    });

    test('throws GPS_ERROR when permission is permanently denied', () async {
      when(() => mockGeolocator.isLocationServiceEnabled()).thenAnswer((_) async => true);
      when(() => mockGeolocator.checkPermission()).thenAnswer((_) async => LocationPermission.deniedForever);

      await expectLater(
        locationService.getCurrentLocation(),
        throwsA(isA<ApiException>()
            .having((e) => e.errorType, 'errorType', 'GPS_ERROR')
            .having((e) => e.message, 'message', 'location_permission_permanently_denied')),
      );
    });

    test('returns coordinates when permission granted and service enabled', () async {
      when(() => mockGeolocator.isLocationServiceEnabled()).thenAnswer((_) async => true);
      when(() => mockGeolocator.checkPermission()).thenAnswer((_) async => LocationPermission.always);
      when(() => mockGeolocator.getCurrentPosition()).thenAnswer(
        (_) async => Position(
          longitude: -15.97,
          latitude: 18.08,
          timestamp: DateTime.now(),
          accuracy: 5.0,
          altitude: 0.0,
          heading: 0.0,
          speed: 0.0,
          speedAccuracy: 0.0,
          altitudeAccuracy: 0.0,
          headingAccuracy: 0.0,
        ),
      );

      final result = await locationService.getCurrentLocation();
      expect(result, {'lat': 18.08, 'lng': -15.97});
    });
  });
}
