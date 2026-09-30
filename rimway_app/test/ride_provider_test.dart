import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:rimway_app/features/ride/application/ride_provider.dart';
import 'package:rimway_app/features/ride/data/ride_repository.dart';
import 'package:rimway_app/features/ride/domain/ride_synchronizer.dart';
import 'package:rimway_app/core/websocket/ws_client.dart';
import 'dart:async';

class MockRideRepository extends Mock implements RideRepository {}
class MockRideSynchronizer extends Mock implements RideSynchronizer {}
class MockWsClient extends Mock implements WsClient {}

void main() {
  late MockRideRepository mockRepo;
  late MockRideSynchronizer mockSync;
  late MockWsClient mockWsClient;
  late StreamController<RideState?> syncController;
  late StreamController<Map<String, dynamic>> wsController;
  late RideProvider rideProvider;

  final sampleServiceType = ServiceTypeModel(
    id: 'st-1',
    name: 'Standard',
    baseFare: 50.0,
    perKm: 15.0,
    perMinute: 2.0,
    surgeRate: 1.0,
    minFare: 50.0,
  );

  final sampleRideModel = RideModel(
    id: 'ride-123',
    status: 'SEARCHING',
    stateVersion: 1,
    pickupLat: 18.0858,
    pickupLng: -15.9785,
    dropoffLat: 18.0800,
    dropoffLng: -15.9700,
    pickupAddress: 'Nouakchott, Tevragh Zeina',
    dropoffAddress: 'Nouakchott, Ksar',
  );

  setUp(() {
    mockRepo = MockRideRepository();
    mockSync = MockRideSynchronizer();
    mockWsClient = MockWsClient();
    syncController = StreamController<RideState?>.broadcast();
    wsController = StreamController<Map<String, dynamic>>.broadcast();

    when(() => mockSync.rideStateStream).thenAnswer((_) => syncController.stream);
    when(() => mockWsClient.rideEvents).thenAnswer((_) => wsController.stream);
    when(() => mockRepo.getServiceTypes()).thenAnswer((_) async => [sampleServiceType]);

    rideProvider = RideProvider(
      rideRepository: mockRepo,
      rideSynchronizer: mockSync,
      wsClient: mockWsClient,
    );
  });

  tearDown(() {
    syncController.close();
    wsController.close();
    rideProvider.dispose();
  });

  group('RideProvider Tests', () {
    test('initial state and service types fetch', () async {
      expect(rideProvider.flowState, RideFlowState.idle);
      await pumpEventQueue();
      expect(rideProvider.serviceTypes.length, 1);
      expect(rideProvider.selectedServiceType?.id, 'st-1');
    });

    test('estimateRide succeeds and updates estimate', () async {
      when(() => mockRepo.estimateRide(
        pickupLat: 18.0858,
        pickupLng: -15.9785,
        dropoffLat: 18.0800,
        dropoffLng: -15.9700,
        serviceTypeId: 'st-1',
      )).thenAnswer((_) async => const RideEstimate(
        estimatedFare: 85.0,
        estimatedDurationMinutes: 10,
        distanceKm: 2.3,
      ));

      final success = await rideProvider.estimateRide(
        pickupLat: 18.0858,
        pickupLng: -15.9785,
        dropoffLat: 18.0800,
        dropoffLng: -15.9700,
        serviceTypeId: 'st-1',
      );

      expect(success, true);
      expect(rideProvider.estimate?.estimatedFare, 85.0);
      expect(rideProvider.flowState, RideFlowState.idle);
    });

    test('requestRide passes idempotency key and updates active ride', () async {
      when(() => mockRepo.requestRide(
        pickupLat: any(named: 'pickupLat'),
        pickupLng: any(named: 'pickupLng'),
        dropoffLat: any(named: 'dropoffLat'),
        dropoffLng: any(named: 'dropoffLng'),
        pickupAddress: any(named: 'pickupAddress'),
        dropoffAddress: any(named: 'dropoffAddress'),
        serviceTypeId: any(named: 'serviceTypeId'),
        idempotencyKey: any(named: 'idempotencyKey'),
      )).thenAnswer((_) async => sampleRideModel);

      when(() => mockSync.syncFromRest(any())).thenReturn(null);

      final success = await rideProvider.requestRide(
        pickupLat: 18.0858,
        pickupLng: -15.9785,
        dropoffLat: 18.0800,
        dropoffLng: -15.9700,
        pickupAddress: 'Tevragh Zeina',
        dropoffAddress: 'Ksar',
        serviceTypeId: 'st-1',
      );

      expect(success, true);
      expect(rideProvider.activeRide?.id, 'ride-123');
      verify(() => mockSync.syncFromRest(any())).called(1);
    });

    test('rateRide calls repository with rating and comment', () async {
      // First assign active ride
      when(() => mockRepo.requestRide(
        pickupLat: any(named: 'pickupLat'),
        pickupLng: any(named: 'pickupLng'),
        dropoffLat: any(named: 'dropoffLat'),
        dropoffLng: any(named: 'dropoffLng'),
        pickupAddress: any(named: 'pickupAddress'),
        dropoffAddress: any(named: 'dropoffAddress'),
        serviceTypeId: any(named: 'serviceTypeId'),
        idempotencyKey: any(named: 'idempotencyKey'),
      )).thenAnswer((_) async => sampleRideModel);
      when(() => mockSync.syncFromRest(any())).thenReturn(null);

      await rideProvider.requestRide(
        pickupLat: 18.0858,
        pickupLng: -15.9785,
        dropoffLat: 18.0800,
        dropoffLng: -15.9700,
        pickupAddress: 'Tevragh Zeina',
        dropoffAddress: 'Ksar',
        serviceTypeId: 'st-1',
      );

      when(() => mockRepo.rateRide(
        rideId: 'ride-123',
        rating: 5,
        comment: 'Great ride!',
      )).thenAnswer((_) async {});

      final rated = await rideProvider.rateRide(rating: 5, comment: 'Great ride!');
      expect(rated, true);
      verify(() => mockRepo.rateRide(
        rideId: 'ride-123',
        rating: 5,
        comment: 'Great ride!',
      )).called(1);
    });
  });
}
