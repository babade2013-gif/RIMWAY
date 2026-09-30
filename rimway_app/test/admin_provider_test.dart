import 'package:flutter_test/flutter_test.dart';
import 'package:rimway_app/features/admin/application/admin_provider.dart';
import 'package:rimway_app/features/admin/data/admin_repository.dart';
import 'package:rimway_app/features/ride/data/ride_repository.dart';
import 'package:rimway_app/core/network/api_client.dart';

class MockAdminRepository implements AdminRepository {
  List<RideModel> ridesToReturn = [];
  RideModel? rideToReturn;
  bool throwError = false;
  int cancelCallCount = 0;
  int getRideDetailsCallCount = 0;

  @override
  // ignore: override_on_non_overriding_member
  ApiClient get apiClient => throw UnimplementedError();

  @override
  Future<List<RideModel>> getRides() async {
    if (throwError) throw Exception('API Error');
    return ridesToReturn;
  }

  @override
  Future<RideModel> getRideDetails(String rideId) async {
    getRideDetailsCallCount++;
    if (throwError) throw Exception('API Error');
    return rideToReturn!;
  }

  @override
  Future<RideModel> createPhoneRide({
    required String customerName,
    required String customerPhone,
    required double pickupLat,
    required double pickupLng,
    required String pickupName,
    required double dropoffLat,
    required double dropoffLng,
    required String dropoffName,
    required String serviceTypeId,
  }) async {
    if (throwError) throw Exception('API Error');
    return rideToReturn!;
  }

  @override
  Future<RideModel> cancelRide({
    required String rideId,
    required int stateVersion,
    String? reason,
  }) async {
    cancelCallCount++;
    if (throwError) throw Exception('409 Conflict');
    return rideToReturn!;
  }
}

void main() {
  late AdminProvider provider;
  late MockAdminRepository mockRepository;

  final dummyRide = RideModel(
    id: 'ride-1',
    status: 'SEARCHING',
    stateVersion: 1,
    customerName: 'Test Customer',
    customerPhone: '+22211111111',
  );

  setUp(() {
    mockRepository = MockAdminRepository();
    provider = AdminProvider(repository: mockRepository);
  });

  test('fetchRides success updates state', () async {
    mockRepository.ridesToReturn = [dummyRide];

    expect(provider.state, AdminState.idle);
    await provider.fetchRides();

    expect(provider.state, AdminState.success);
    expect(provider.rides.length, 1);
    expect(provider.rides.first.id, 'ride-1');
  });

  test('createPhoneRide success adds ride to list', () async {
    mockRepository.rideToReturn = dummyRide;

    final success = await provider.createPhoneRide(
      customerName: 'Test Customer',
      customerPhone: '+22211111111',
      pickupLat: 18.0, pickupLng: -15.0, pickupName: 'A',
      dropoffLat: 18.1, dropoffLng: -15.1, dropoffName: 'B',
      serviceTypeId: 'standard',
    );

    expect(success, true);
    expect(provider.state, AdminState.success);
    expect(provider.rides.length, 1);
    expect(provider.rides.first.customerName, 'Test Customer');
  });

  test('cancelRide success updates selected ride', () async {
    mockRepository.rideToReturn = dummyRide;
    await provider.fetchRideDetails('ride-1');

    final cancelledRide = dummyRide.copyWith(status: 'CANCELLED_BY_ADMIN', stateVersion: 2);
    mockRepository.rideToReturn = cancelledRide;

    final success = await provider.cancelRide('test reason');

    expect(success, true);
    expect(provider.selectedRide!.status, 'CANCELLED_BY_ADMIN');
    expect(provider.selectedRide!.stateVersion, 2);
  });

  test('cancelRide 409 conflict refreshes ride details', () async {
    mockRepository.rideToReturn = dummyRide;
    await provider.fetchRideDetails('ride-1');

    mockRepository.throwError = true;
    final staleRide = dummyRide.copyWith(stateVersion: 2, status: 'DRIVER_ASSIGNED');
    
    // We override getRideDetails to not throw error during refresh
    mockRepository.getRideDetailsCallCount = 0; // reset
    
    final mockProvider = AdminProvider(
      repository: _MockAdminRepositoryConflict(dummyRide, staleRide)
    );
    await mockProvider.fetchRideDetails('ride-1');
    final success = await mockProvider.cancelRide('test');
    expect(success, false);
    expect(mockProvider.selectedRide!.stateVersion, 2);
  });
}

class _MockAdminRepositoryConflict implements AdminRepository {
  final RideModel initialRide;
  final RideModel staleRide;
  bool fetchedFirst = false;

  _MockAdminRepositoryConflict(this.initialRide, this.staleRide);
  
  @override
  // ignore: override_on_non_overriding_member
  ApiClient get apiClient => throw UnimplementedError();

  @override
  Future<RideModel> cancelRide({required String rideId, required int stateVersion, String? reason}) async {
    throw Exception('409 Conflict');
  }

  @override
  Future<RideModel> createPhoneRide({required String customerName, required String customerPhone, required double pickupLat, required double pickupLng, required String pickupName, required double dropoffLat, required double dropoffLng, required String dropoffName, required String serviceTypeId}) {
    throw UnimplementedError();
  }

  @override
  Future<RideModel> getRideDetails(String rideId) async {
    if (!fetchedFirst) {
      fetchedFirst = true;
      return initialRide;
    }
    return staleRide;
  }

  @override
  Future<List<RideModel>> getRides() {
    throw UnimplementedError();
  }
}
