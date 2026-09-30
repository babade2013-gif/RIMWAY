import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import '../data/ride_repository.dart';
import '../../ride/domain/ride_synchronizer.dart';
import '../../../core/websocket/ws_client.dart';

enum RideFlowState {
  idle,
  estimating,
  requesting,
  searching,
  driverAssigned,
  driverArrived,
  inProgress,
  completed,
  noDriverFound,
  cancelled,
  error,
}

class RideProvider extends ChangeNotifier {
  final RideRepository rideRepository;
  final RideSynchronizer rideSynchronizer;
  final WsClient wsClient;

  RideFlowState _flowState = RideFlowState.idle;
  RideFlowState get flowState => _flowState;

  RideEstimate? _estimate;
  RideEstimate? get estimate => _estimate;

  RideModel? _activeRide;
  RideModel? get activeRide => _activeRide;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  List<ServiceTypeModel> _serviceTypes = [];
  List<ServiceTypeModel> get serviceTypes => _serviceTypes;

  ServiceTypeModel? _selectedServiceType;
  ServiceTypeModel? get selectedServiceType => _selectedServiceType;

  StreamSubscription<RideState?>? _rideSyncSub;
  StreamSubscription? _wsSub;

  RideProvider({
    required this.rideRepository,
    required this.rideSynchronizer,
    required this.wsClient,
  }) {
    _listenToRideSynchronizer();
    _listenToWebSocket();
    fetchServiceTypes();
  }

  void _listenToRideSynchronizer() {
    _rideSyncSub = rideSynchronizer.rideStateStream.listen((rideState) {
      if (rideState == null) {
        // Ride cleared externally
        if (_flowState != RideFlowState.idle) {
          _flowState = RideFlowState.idle;
          _activeRide = null;
          notifyListeners();
        }
        return;
      }
      _applyStatus(rideState.status);
    });
  }

  void _listenToWebSocket() {
    // WsClient.rideEvents already emits the ride payload directly
    _wsSub = wsClient.rideEvents.listen((data) {
      rideSynchronizer.syncFromWebSocket(data);
    });
  }

  void _applyStatus(String status) {
    final prev = _flowState;
    switch (status) {
      case 'SEARCHING':
        _flowState = RideFlowState.searching;
      case 'DRIVER_ASSIGNED':
        _flowState = RideFlowState.driverAssigned;
      case 'DRIVER_ARRIVED':
      case 'DRIVER_ARRIVING':
      case 'WAITING_FOR_PASSENGER':
        _flowState = RideFlowState.driverArrived;
      case 'IN_PROGRESS':
        _flowState = RideFlowState.inProgress;
      case 'COMPLETED':
        _flowState = RideFlowState.completed;
      case 'NO_DRIVER_FOUND':
        _flowState = RideFlowState.noDriverFound;
      case 'CANCELLED_BY_PASSENGER':
      case 'CANCELLED_BY_DRIVER':
        _flowState = RideFlowState.cancelled;
      default:
        _flowState = RideFlowState.searching;
    }
    if (prev != _flowState) notifyListeners();
  }

  Future<void> fetchServiceTypes() async {
    try {
      _serviceTypes = await rideRepository.getServiceTypes();
      if (_serviceTypes.isNotEmpty && _selectedServiceType == null) {
        _selectedServiceType = _serviceTypes.first;
      }
      notifyListeners();
    } catch (_) {
      // Keep empty if network fails, user can retry
    }
  }

  void selectServiceType(ServiceTypeModel type) {
    _selectedServiceType = type;
    notifyListeners();
  }

  /// Get fare estimate without committing to a ride
  Future<bool> estimateRide({
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    String? serviceTypeId,
  }) async {
    _flowState = RideFlowState.estimating;
    _errorMessage = null;
    notifyListeners();

    try {
      var sId = serviceTypeId ?? _selectedServiceType?.id;
      if (sId == null || sId.isEmpty) {
        await fetchServiceTypes();
        sId = serviceTypeId ?? _selectedServiceType?.id;
      }
      if (sId == null || sId.isEmpty) {
        throw Exception('No active service type');
      }

      _estimate = await rideRepository.estimateRide(
        pickupLat: pickupLat,
        pickupLng: pickupLng,
        dropoffLat: dropoffLat,
        dropoffLng: dropoffLng,
        serviceTypeId: sId,
      );
      _flowState = RideFlowState.idle;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'estimate_failed';
      _flowState = RideFlowState.idle;
      notifyListeners();
      return false;
    }
  }

  /// Request a ride — transitions to searching state
  Future<bool> requestRide({
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    required String pickupAddress,
    required String dropoffAddress,
    String? serviceTypeId,
  }) async {
    _flowState = RideFlowState.requesting;
    _errorMessage = null;
    notifyListeners();

    try {
      var sId = serviceTypeId ?? _selectedServiceType?.id;
      if (sId == null || sId.isEmpty) {
        await fetchServiceTypes();
        sId = serviceTypeId ?? _selectedServiceType?.id;
      }
      if (sId == null || sId.isEmpty) {
        throw Exception('No active service type');
      }

      final idempotencyKey = _generateUuidV4();
      final ride = await rideRepository.requestRide(
        pickupLat: pickupLat,
        pickupLng: pickupLng,
        dropoffLat: dropoffLat,
        dropoffLng: dropoffLng,
        pickupAddress: pickupAddress,
        dropoffAddress: dropoffAddress,
        serviceTypeId: sId,
        idempotencyKey: idempotencyKey,
      );
      _activeRide = ride;
      // Sync from the REST response to initialize RideSynchronizer
      rideSynchronizer.syncFromRest({
        'id': ride.id,
        'status': ride.status,
        'stateVersion': ride.stateVersion,
      });
      // State will be updated via _listenToRideSynchronizer
      return true;
    } catch (e) {
      _errorMessage = 'request_failed';
      _flowState = RideFlowState.error;
      notifyListeners();
      return false;
    }
  }

  /// Rate a completed ride
  Future<bool> rateRide({
    required int rating,
    String? comment,
  }) async {
    if (_activeRide == null) return false;
    try {
      await rideRepository.rateRide(
        rideId: _activeRide!.id,
        rating: rating,
        comment: comment,
      );
      return true;
    } catch (e) {
      _errorMessage = 'rate_failed';
      notifyListeners();
      return false;
    }
  }

  /// Cancel the active ride
  Future<bool> cancelRide() async {
    if (_activeRide == null) return false;
    try {
      await rideRepository.cancelRide(rideId: _activeRide!.id);
      rideSynchronizer.clear();
      _activeRide = null;
      _flowState = RideFlowState.idle;
      _estimate = null;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'cancel_failed';
      notifyListeners();
      return false;
    }
  }

  /// Called at app startup to restore existing ride
  Future<void> checkActiveRide() async {
    final ride = await rideRepository.getCurrentRide();
    if (ride != null) {
      _activeRide = ride;
      rideSynchronizer.syncFromRest({
        'id': ride.id,
        'status': ride.status,
        'stateVersion': ride.stateVersion,
      });
    }
  }

  /// Reset to idle after completing/cancelling
  void resetToIdle() {
    _flowState = RideFlowState.idle;
    _activeRide = null;
    _estimate = null;
    _errorMessage = null;
    rideSynchronizer.clear();
    notifyListeners();
  }

  String _generateUuidV4() {
    final rnd = Random.secure();
    final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final chars = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).toList();
    return '${chars.sublist(0, 4).join()}-${chars.sublist(4, 6).join()}-${chars.sublist(6, 8).join()}-${chars.sublist(8, 10).join()}-${chars.sublist(10, 16).join()}';
  }

  @override
  void dispose() {
    _rideSyncSub?.cancel();
    _wsSub?.cancel();
    super.dispose();
  }
}
