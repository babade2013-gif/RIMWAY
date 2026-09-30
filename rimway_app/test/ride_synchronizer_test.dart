import 'package:test/test.dart';
// Note: using direct path due to missing flutter test env
import '../lib/features/ride/domain/ride_synchronizer.dart';

void main() {
  group('RideSynchronizer StateVersion Tests', () {
    late RideSynchronizer synchronizer;

    setUp(() {
      synchronizer = RideSynchronizer();
    });

    test('accepts initial state', () {
      synchronizer.syncFromRest({'id': 'ride1', 'status': 'SEARCHING', 'stateVersion': 5});
      expect(synchronizer.currentRide?.stateVersion, 5);
      expect(synchronizer.currentRide?.status, 'SEARCHING');
    });

    test('incoming 4 when current 5 => ignored', () {
      synchronizer.syncFromRest({'id': 'ride1', 'status': 'SEARCHING', 'stateVersion': 5});
      synchronizer.syncFromWebSocket({'rideId': 'ride1', 'status': 'DRIVER_ASSIGNED', 'stateVersion': 4});
      
      expect(synchronizer.currentRide?.stateVersion, 5);
      expect(synchronizer.currentRide?.status, 'SEARCHING');
    });

    test('incoming 5 when current 5 => ignored', () {
      synchronizer.syncFromRest({'id': 'ride1', 'status': 'SEARCHING', 'stateVersion': 5});
      synchronizer.syncFromWebSocket({'rideId': 'ride1', 'status': 'DRIVER_ASSIGNED', 'stateVersion': 5});
      
      expect(synchronizer.currentRide?.stateVersion, 5);
      expect(synchronizer.currentRide?.status, 'SEARCHING');
    });

    test('incoming 6 when current 5 => applied', () {
      synchronizer.syncFromRest({'id': 'ride1', 'status': 'SEARCHING', 'stateVersion': 5});
      synchronizer.syncFromWebSocket({'rideId': 'ride1', 'status': 'DRIVER_ASSIGNED', 'stateVersion': 6});
      
      expect(synchronizer.currentRide?.stateVersion, 6);
      expect(synchronizer.currentRide?.status, 'DRIVER_ASSIGNED');
    });

    test('incoming 7 then 6 => 6 ignored', () {
      synchronizer.syncFromRest({'id': 'ride1', 'status': 'SEARCHING', 'stateVersion': 5});
      synchronizer.syncFromWebSocket({'rideId': 'ride1', 'status': 'DRIVER_ARRIVED', 'stateVersion': 7});
      expect(synchronizer.currentRide?.stateVersion, 7);
      expect(synchronizer.currentRide?.status, 'DRIVER_ARRIVED');

      // Delayed packet arrives
      synchronizer.syncFromWebSocket({'rideId': 'ride1', 'status': 'DRIVER_ASSIGNED', 'stateVersion': 6});
      expect(synchronizer.currentRide?.stateVersion, 7);
      expect(synchronizer.currentRide?.status, 'DRIVER_ARRIVED');
    });

    test('incoming 8 then 9 => both applied', () {
      synchronizer.syncFromRest({'id': 'ride1', 'status': 'SEARCHING', 'stateVersion': 5});
      
      synchronizer.syncFromWebSocket({'rideId': 'ride1', 'status': 'IN_PROGRESS', 'stateVersion': 8});
      expect(synchronizer.currentRide?.stateVersion, 8);
      
      synchronizer.syncFromWebSocket({'rideId': 'ride1', 'status': 'COMPLETED', 'stateVersion': 9});
      expect(synchronizer.currentRide?.stateVersion, 9);
      expect(synchronizer.currentRide?.status, 'COMPLETED');
    });
  });
}
