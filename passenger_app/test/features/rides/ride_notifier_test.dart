import 'package:flutter_test/flutter_test.dart';
import 'package:passenger_app/features/rides/domain/models/ride.dart';
import 'package:passenger_app/features/rides/domain/models/ride_status.dart';
import 'package:passenger_app/features/rides/presentation/providers/ride_provider.dart';

// Manual Mock Repository
class MockRideRepository implements RideRepository {
  int requestCount = 0;
  String? lastIdempotencyKey;
  bool throwError = false;
  Ride? mockCurrentRideResponse;

  @override
  Future<Ride> requestRide(Map<String, dynamic> payload, String idempotencyKey) async {
    requestCount++;
    lastIdempotencyKey = idempotencyKey;
    if (throwError) throw Exception('Network Failure');
    return Ride(id: '1', status: RideStatus.SEARCHING, stateVersion: 1, estimatedFare: 100, updatedAt: DateTime.now());
  }

  @override
  Future<Ride?> getCurrentRide() async => mockCurrentRideResponse;

  @override
  Future<void> cancelRide(String rideId) async {
    if (throwError) throw Exception('Cancel Error');
  }
  
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late MockRideRepository mockRepo;
  late RideNotifier notifier;

  setUp(() {
    mockRepo = MockRideRepository();
    notifier = RideNotifier(mockRepo);
  });

  group('WebSocket State Version Tests', () {
    final currentRide = Ride(id: 'ride-1', status: RideStatus.SEARCHING, stateVersion: 5, estimatedFare: 10, updatedAt: DateTime.now());
    
    test('Test A - Older version ignored', () {
      notifier.state = notifier.state.copyWith(activeRide: currentRide);
      notifier.onWebSocketEvent({'id': 'ride-1', 'status': 'DRIVER_ASSIGNED', 'stateVersion': 4, 'estimatedFare': 10, 'updatedAt': '2026-09-13T00:00:00Z'});
      expect(notifier.state.activeRide?.stateVersion, 5); // Remained 5
    });

    test('Test B - Same version ignored', () {
      notifier.state = notifier.state.copyWith(activeRide: currentRide);
      notifier.onWebSocketEvent({'id': 'ride-1', 'status': 'DRIVER_ASSIGNED', 'stateVersion': 5, 'estimatedFare': 10, 'updatedAt': '2026-09-13T00:00:00Z'});
      expect(notifier.state.activeRide?.status, RideStatus.SEARCHING); // Not overwritten
    });

    test('Test C - Newer version accepted', () {
      notifier.state = notifier.state.copyWith(activeRide: currentRide);
      notifier.onWebSocketEvent({'id': 'ride-1', 'status': 'DRIVER_ASSIGNED', 'stateVersion': 6, 'estimatedFare': 10, 'updatedAt': '2026-09-13T00:00:00Z'});
      expect(notifier.state.activeRide?.stateVersion, 6);
      expect(notifier.state.activeRide?.status, RideStatus.DRIVER_ASSIGNED);
    });

    test('Test D - Different rideId ignored (even with newer version)', () {
      notifier.state = notifier.state.copyWith(activeRide: currentRide);
      notifier.onWebSocketEvent({'id': 'ride-2', 'status': 'IN_PROGRESS', 'stateVersion': 99, 'estimatedFare': 10, 'updatedAt': '2026-09-13T00:00:00Z'});
      expect(notifier.state.activeRide?.id, 'ride-1'); // Remained ride-1
    });

    test('Malformed payload safely ignored', () {
      notifier.state = notifier.state.copyWith(activeRide: currentRide);
      notifier.onWebSocketEvent({'bad_payload': true}); // Will throw inside fromJson
      expect(notifier.state.activeRide?.stateVersion, 5); // No crash, state unchanged
    });
  });

  test('Reconciliation Race Test - Protect WS state from stale HTTP', () async {
    final currentRide = Ride(id: 'ride-1', status: RideStatus.DRIVER_ASSIGNED, stateVersion: 8, estimatedFare: 10, updatedAt: DateTime.now());
    notifier.state = notifier.state.copyWith(activeRide: currentRide);
    
    // HTTP response brings stale stateVersion 7
    mockRepo.mockCurrentRideResponse = Ride(id: 'ride-1', status: RideStatus.SEARCHING, stateVersion: 7, estimatedFare: 10, updatedAt: DateTime.now());
    await notifier.recoverCurrentRide();
    
    // Final state must remain version 8
    expect(notifier.state.activeRide?.stateVersion, 8);
  });

  test('Idempotency Key Tests', () async {
    mockRepo.throwError = true;
    
    // First request
    await notifier.requestRide({});
    final firstKey = notifier.state.activeIdempotencyKey;
    expect(firstKey, isNotNull);
    expect(mockRepo.lastIdempotencyKey, firstKey);
    
    // Retry request
    await notifier.requestRide({});
    final retryKey = notifier.state.activeIdempotencyKey;
    expect(retryKey, firstKey); // EXACT SAME KEY
  });

  test('Cancellation Test - Backend first mutation', () async {
    final currentRide = Ride(id: 'ride-1', status: RideStatus.SEARCHING, stateVersion: 1, estimatedFare: 10, updatedAt: DateTime.now());
    notifier.state = notifier.state.copyWith(activeRide: currentRide);
    
    // Case 1: Fails
    mockRepo.throwError = true;
    await notifier.cancelRide();
    expect(notifier.state.activeRide, isNotNull); // Not cleared!
    
    // Case 2: Succeeds
    mockRepo.throwError = false;
    await notifier.cancelRide();
    expect(notifier.state.activeRide, isNull); // Cleared locally after success
  });
}
