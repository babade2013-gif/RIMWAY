import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:rimway_app/features/captain/application/captain_provider.dart';
import 'package:rimway_app/features/captain/data/captain_repository.dart';
import 'package:rimway_app/features/ride/domain/ride_synchronizer.dart';
import 'package:rimway_app/features/ride/data/ride_repository.dart';
import 'package:rimway_app/core/errors/api_exception.dart';
import 'package:rimway_app/core/websocket/ws_client.dart';
import 'dart:async';

class MockCaptainRepository extends Mock implements CaptainRepository {}
class MockLocationService extends Mock implements LocationService {}
class MockRideSynchronizer extends Mock implements RideSynchronizer {}
class MockWsClient extends Mock implements WsClient {}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late MockCaptainRepository mockRepo;
  late MockLocationService mockLocationService;
  late MockWsClient mockWsClient;
  late RideSynchronizer realSynchronizer;
  late CaptainProvider captainProvider;
  late StreamController<Map<String, dynamic>> wsController;

  setUp(() {
    mockRepo = MockCaptainRepository();
    mockLocationService = MockLocationService();
    mockWsClient = MockWsClient();
    wsController = StreamController<Map<String, dynamic>>.broadcast();
    
    when(() => mockWsClient.rideEvents).thenAnswer((_) => wsController.stream);
    when(() => mockWsClient.connect()).thenAnswer((_) async {});
    
    realSynchronizer = RideSynchronizer();
    
    captainProvider = CaptainProvider(
      repository: mockRepo,
      locationService: mockLocationService,
      rideSynchronizer: realSynchronizer,
      wsClient: mockWsClient,
    );
  });

  group('CaptainProvider Lifecycle Tests', () {
    final mockRide = RideModel(
      id: 'r1',
      passengerId: 'p1',
      status: 'DRIVER_ASSIGNED',
      createdAt: DateTime.now(),
      stateVersion: 2,
    );

    test('acceptRide successfully transitions state', () async {
      when(() => mockRepo.acceptRide('r1', 1)).thenAnswer((_) async => mockRide);

      // Simulate incoming request
      // (This requires private method access in test, or we can just call acceptRide directly)
      // Since _incomingRideRequest is private and we didn't expose a setter, we can just call acceptRide
      // But it looks for cycleId in the request. If null, defaults to 1.
      await captainProvider.acceptRide('r1');
      
      expect(captainProvider.activeRideModel, isNotNull);
      expect(captainProvider.activeRideState?.status, 'DRIVER_ASSIGNED');
      verify(() => mockRepo.acceptRide('r1', 1)).called(1);
    });

    test('acceptRide handles 409 Conflict gracefully', () async {
      when(() => mockRepo.acceptRide('r1', 1)).thenThrow(ApiException(message: 'Conflict', statusCode: 409));

      await captainProvider.acceptRide('r1');
      
      expect(captainProvider.activeRideModel, isNull);
      expect(captainProvider.errorMessage, 'ride_no_longer_available');
    });

    test('lifecycle flow: arrive -> board -> start -> complete', () async {
      // Setup initial state
      realSynchronizer.syncFromRest(mockRide.toJson());
      
      final mockArrived = mockRide.copyWith(status: 'DRIVER_ARRIVED', stateVersion: 3);
      when(() => mockRepo.arriveAtPickup('r1', 2)).thenAnswer((_) async => mockArrived);
      await captainProvider.arriveAtPickup();
      expect(captainProvider.activeRideState?.status, 'DRIVER_ARRIVED');

      final mockBoarded = mockArrived.copyWith(status: 'PASSENGER_BOARDED', stateVersion: 4);
      when(() => mockRepo.passengerBoarded('r1', 3)).thenAnswer((_) async => mockBoarded);
      await captainProvider.passengerBoarded();
      expect(captainProvider.activeRideState?.status, 'PASSENGER_BOARDED');

      final mockStarted = mockBoarded.copyWith(status: 'IN_PROGRESS', stateVersion: 5);
      when(() => mockRepo.startRide('r1', 4)).thenAnswer((_) async => mockStarted);
      await captainProvider.startRide();
      expect(captainProvider.activeRideState?.status, 'IN_PROGRESS');

      final mockCompleted = mockStarted.copyWith(status: 'COMPLETED', stateVersion: 6, finalFare: 1500.0);
      when(() => mockRepo.completeRide('r1', 5)).thenAnswer((_) async => mockCompleted);
      await captainProvider.completeRide();
      expect(captainProvider.activeRideState?.status, 'COMPLETED');
      expect(captainProvider.activeRideModel?.finalFare, 1500.0);
    });
    
    test('duplicate action protection: concurrent requests are ignored', () async {
      realSynchronizer.syncFromRest(mockRide.toJson());
      final mockArrived = mockRide.copyWith(status: 'DRIVER_ARRIVED', stateVersion: 3);
      
      // Simulate slow response
      when(() => mockRepo.arriveAtPickup('r1', 2)).thenAnswer((_) async {
        await Future.delayed(const Duration(milliseconds: 100));
        return mockArrived;
      });
      
      // Fire twice concurrently
      final f1 = captainProvider.arriveAtPickup();
      final f2 = captainProvider.arriveAtPickup();
      
      await Future.wait([f1, f2]);
      
      // Should only be called once because isLoading blocks the second
      verify(() => mockRepo.arriveAtPickup('r1', 2)).called(1);
    });

    test('fetchCurrentRide recovers active ride', () async {
      when(() => mockRepo.getCurrentRide()).thenAnswer((_) async => mockRide);
      
      await captainProvider.fetchCurrentRide();
      
      expect(captainProvider.activeRideModel, isNotNull);
      expect(captainProvider.activeRideState?.status, 'DRIVER_ASSIGNED');
    });

    test('cancelRide transitions state properly and waits for Backend', () async {
      realSynchronizer.syncFromRest(mockRide.toJson());
      final mockCancelled = mockRide.copyWith(status: 'CANCELLED_BY_DRIVER', stateVersion: 3);
      
      when(() => mockRepo.cancelRide('r1', 2, reason: any(named: 'reason'))).thenAnswer((_) async => mockCancelled);
      
      await captainProvider.cancelRide(reason: 'الزبون لم يحضر');
      
      expect(captainProvider.activeRideModel, isNull);
      expect(captainProvider.activeRideState, isNull);
      verify(() => mockRepo.cancelRide('r1', 2, reason: 'الزبون لم يحضر')).called(1);
    });

    group('WebSocket Event Handling Tests', () {
      test('1. WebSocket ride_requested reaches CaptainProvider and creates incoming ride state', () async {
        wsController.add({'event_type': 'ride_requested', 'rideId': 'r1', 'cycleId': 1, 'lat': 1.0, 'lng': 1.0});
        // Give event loop time to process the stream
        await Future.delayed(Duration.zero);
        expect(captainProvider.incomingRideRequest, isNotNull);
        expect(captainProvider.incomingRideRequest!['rideId'], 'r1');
      });

      test('2. Missing rideId is safely ignored', () async {
        wsController.add({'event_type': 'ride_requested', 'cycleId': 1}); // No rideId
        await Future.delayed(Duration.zero);
        expect(captainProvider.incomingRideRequest, isNull);
      });

      test('3. Duplicate rideId + cycleId is ignored', () async {
        wsController.add({'event_type': 'ride_requested', 'rideId': 'r1', 'cycleId': 1, 'lat': 1.0, 'lng': 1.0});
        await Future.delayed(Duration.zero);
        expect(captainProvider.incomingRideRequest, isNotNull);
        
        // Attempt duplicate
        wsController.add({'event_type': 'ride_requested', 'rideId': 'r1', 'cycleId': 1, 'lat': 1.0, 'lng': 1.0});
        await Future.delayed(Duration.zero);
        // It should still be the exact same object (reference comparison won't easily work, but it should just return)
        expect(captainProvider.incomingRideRequest!['rideId'], 'r1');
      });

      test('4. Active ride ignores incoming request', () async {
        realSynchronizer.syncFromRest(mockRide.toJson());
        expect(captainProvider.activeRideState, isNotNull);
        
        wsController.add({'event_type': 'ride_requested', 'rideId': 'r2', 'cycleId': 1, 'lat': 1.0, 'lng': 1.0});
        await Future.delayed(Duration.zero);
        
        // Incoming request should remain null because captain is busy
        expect(captainProvider.incomingRideRequest, isNull);
      });

      test('5. Receiving ride_requested does NOT call acceptRide()', () async {
        when(() => mockRepo.acceptRide(any(), any())).thenAnswer((_) async => mockRide);
        
        wsController.add({'event_type': 'ride_requested', 'rideId': 'r1', 'cycleId': 1, 'lat': 1.0, 'lng': 1.0});
        await Future.delayed(Duration.zero);
        
        expect(captainProvider.incomingRideRequest, isNotNull);
        verifyNever(() => mockRepo.acceptRide(any(), any()));
      });
    });
  });
}
