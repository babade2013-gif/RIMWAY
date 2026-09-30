import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:rimway_app/features/captain/application/captain_provider.dart';
import 'package:rimway_app/features/captain/data/captain_repository.dart';
import 'package:rimway_app/features/ride/data/ride_repository.dart';
import 'package:rimway_app/core/localization/app_localizations.dart';
import 'package:flutter/material.dart';

class MockCaptainRepository extends Mock implements CaptainRepository {}
class MockLocationService extends Mock implements LocationService {}

void main() {
  group('Captain Registration Flow & Status Tests', () {
    late MockCaptainRepository mockRepo;
    late MockLocationService mockLocation;
    late CaptainProvider provider;

    setUp(() {
      mockRepo = MockCaptainRepository();
      mockLocation = MockLocationService();
      provider = CaptainProvider(
        repository: mockRepo,
        locationService: mockLocation,
      );
    });

    test('1. fetchRegistrationStatus maps APPROVED correctly', () async {
      when(() => mockRepo.getMe()).thenAnswer((_) async => {
        'id': 'dr-1',
        'status': 'APPROVED',
        'registrationStatus': 'APPROVED',
        'rejectionReason': null,
      });

      await provider.fetchRegistrationStatus();

      expect(provider.registrationStatus, CaptainRegistrationStatus.approved);
      expect(provider.rejectionReason, isNull);
    });

    test('2. fetchRegistrationStatus maps PENDING_REVIEW correctly', () async {
      when(() => mockRepo.getMe()).thenAnswer((_) async => {
        'id': 'dr-1',
        'status': 'PENDING',
        'registrationStatus': 'PENDING_REVIEW',
        'rejectionReason': null,
      });

      await provider.fetchRegistrationStatus();

      expect(provider.registrationStatus, CaptainRegistrationStatus.pendingReview);
    });

    test('3. fetchRegistrationStatus maps REJECTED and preserves exact admin reason', () async {
      const reason = 'صورة رخصة السياقة غير واضحة';
      when(() => mockRepo.getMe()).thenAnswer((_) async => {
        'id': 'dr-1',
        'status': 'REJECTED',
        'registrationStatus': 'REJECTED',
        'rejectionReason': reason,
      });

      await provider.fetchRegistrationStatus();

      expect(provider.registrationStatus, CaptainRegistrationStatus.rejected);
      expect(provider.rejectionReason, reason);
    });

    test('4. fetchRegistrationStatus maps SUSPENDED correctly', () async {
      when(() => mockRepo.getMe()).thenAnswer((_) async => {
        'id': 'dr-1',
        'status': 'SUSPENDED',
        'registrationStatus': 'SUSPENDED',
      });

      await provider.fetchRegistrationStatus();

      expect(provider.registrationStatus, CaptainRegistrationStatus.suspended);
    });

    test('5. fetchRegistrationStatus maps REGISTRATION_INCOMPLETE correctly', () async {
      when(() => mockRepo.getMe()).thenAnswer((_) async => {
        'id': 'dr-1',
        'status': 'PENDING',
        'registrationStatus': 'REGISTRATION_INCOMPLETE',
      });

      await provider.fetchRegistrationStatus();

      expect(provider.registrationStatus, CaptainRegistrationStatus.incomplete);
    });

    test('6. submitRegistration transitions status to PENDING_REVIEW', () async {
      final payload = {
        'name': 'Ahmed',
        'vehicle': {
          'brand': 'Toyota',
          'model': 'Corolla',
          'year': 2020,
          'color': 'White',
          'plateNumber': '1234AA00',
          'serviceTypeId': 'st-1',
        },
        'documents': [],
        'vehiclePhotos': [],
      };

      when(() => mockRepo.submitRegistration(payload)).thenAnswer((_) async => {
        'id': 'dr-1',
        'status': 'PENDING',
        'registrationStatus': 'PENDING_REVIEW',
      });

      final success = await provider.submitRegistration(payload);

      expect(success, isTrue);
      expect(provider.registrationStatus, CaptainRegistrationStatus.pendingReview);
      expect(provider.rejectionReason, isNull);
    });

    test('7. loadServices dynamically updates available services', () async {
      when(() => mockRepo.getServices()).thenAnswer((_) async => [
        const ServiceTypeModel(
          id: 'st-1',
          name: 'Standard',
          baseFare: 10,
          perKm: 2,
          perMinute: 0.5,
          surgeRate: 1.0,
          minFare: 15,
        ),
        const ServiceTypeModel(
          id: 'st-2',
          name: 'Business',
          baseFare: 20,
          perKm: 4,
          perMinute: 1.0,
          surgeRate: 1.0,
          minFare: 30,
        ),
      ]);

      await provider.loadServices();

      expect(provider.availableServices.length, 2);
      expect(provider.availableServices[0].name, 'Standard');
      expect(provider.availableServices[1].name, 'Business');
    });
  });

  group('Bilingual Localization Tests (Arabic & French)', () {
    test('Arabic translations contain all Captain registration keys', () {
      final ar = AppLocalizations(const Locale('ar'));
      expect(ar.translate('start'), 'ابدأ');
      expect(ar.translate('status_pending_review'), 'طلبك قيد المراجعة');
      expect(ar.translate('status_rejected'), 'لم تتم الموافقة على الطلب');
      expect(ar.translate('national_id'), contains('التعريف'));
      expect(ar.translate('driving_license'), contains('رخصة السياقة'));
      expect(ar.translate('vehicle_front'), contains('الأمام'));
      expect(ar.translate('vehicle_back'), contains('الخلف'));
      expect(ar.translate('vehicle_right'), contains('اليمين'));
      expect(ar.translate('vehicle_left'), contains('اليسار'));
    });

    test('French translations contain all Captain registration keys', () {
      final fr = AppLocalizations(const Locale('fr'));
      expect(fr.translate('start'), 'Commencer');
      expect(fr.translate('status_pending_review'), 'Votre demande est en cours d\'examen');
      expect(fr.translate('status_rejected'), 'Demande d\'inscription refusée');
      expect(fr.translate('national_id'), 'Carte Nationale d\'Identité');
      expect(fr.translate('driving_license'), contains('Permis'));
      expect(fr.translate('vehicle_front'), contains('face'));
      expect(fr.translate('vehicle_back'), contains('dos'));
      expect(fr.translate('vehicle_right'), contains('droit'));
      expect(fr.translate('vehicle_left'), contains('gauche'));
    });
  });
}
