import 'package:flutter/foundation.dart';
import '../data/admin_repository.dart';
import '../../ride/data/ride_repository.dart';

enum AdminState { idle, loading, success, error }

class AdminProvider extends ChangeNotifier {
  final AdminRepository repository;

  AdminState _state = AdminState.idle;
  AdminState get state => _state;

  List<RideModel> _rides = [];
  List<RideModel> get rides => _rides;

  RideModel? _selectedRide;
  RideModel? get selectedRide => _selectedRide;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  AdminProvider({required this.repository});

  Future<void> fetchRides() async {
    _state = AdminState.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      _rides = await repository.getRides();
      _state = AdminState.success;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _state = AdminState.error;
      notifyListeners();
    }
  }

  Future<void> fetchRideDetails(String rideId) async {
    _state = AdminState.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      _selectedRide = await repository.getRideDetails(rideId);
      _state = AdminState.success;
      notifyListeners();
    } catch (e) {
      _errorMessage = e.toString();
      _state = AdminState.error;
      notifyListeners();
    }
  }

  Future<bool> createPhoneRide({
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
    _state = AdminState.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      final ride = await repository.createPhoneRide(
        customerName: customerName,
        customerPhone: customerPhone,
        pickupLat: pickupLat,
        pickupLng: pickupLng,
        pickupName: pickupName,
        dropoffLat: dropoffLat,
        dropoffLng: dropoffLng,
        dropoffName: dropoffName,
        serviceTypeId: serviceTypeId,
      );
      _rides.insert(0, ride);
      _state = AdminState.success;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'create_failed';
      _state = AdminState.error;
      notifyListeners();
      return false;
    }
  }

  Future<bool> cancelRide(String reason) async {
    if (_selectedRide == null) return false;
    
    _state = AdminState.loading;
    _errorMessage = null;
    notifyListeners();

    try {
      final updatedRide = await repository.cancelRide(
        rideId: _selectedRide!.id,
        stateVersion: _selectedRide!.stateVersion,
        reason: reason,
      );
      
      _selectedRide = updatedRide;
      
      // Update in list if exists
      final index = _rides.indexWhere((r) => r.id == updatedRide.id);
      if (index != -1) {
        _rides[index] = updatedRide;
      }

      _state = AdminState.success;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'cancel_failed';
      _state = AdminState.error;
      notifyListeners();
      
      // If 409 conflict, we should reload the ride to get latest state
      if (e.toString().contains('409') || e.toString().contains('Conflict')) {
        await fetchRideDetails(_selectedRide!.id);
      }
      return false;
    }
  }
}
