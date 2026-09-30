import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../domain/models/ride.dart';
import '../domain/models/ride_status.dart';
import '../data/ride_repository.dart';

class RideState {
  final Ride? activeRide;
  final bool isLoading;
  final String? error;
  final Map<String, dynamic>? currentEstimate;
  final String? activeIdempotencyKey;

  RideState({this.activeRide, this.isLoading = false, this.error, this.currentEstimate, this.activeIdempotencyKey});

  RideState copyWith({Ride? activeRide, bool? isLoading, String? error, Map<String, dynamic>? currentEstimate, String? activeIdempotencyKey}) {
    return RideState(
      activeRide: activeRide ?? this.activeRide,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      currentEstimate: currentEstimate ?? this.currentEstimate,
      activeIdempotencyKey: activeIdempotencyKey ?? this.activeIdempotencyKey,
    );
  }
}

class RideNotifier extends StateNotifier<RideState> {
  final RideRepository _repo;
  RideNotifier(this._repo) : super(RideState());

  Future<void> recoverCurrentRide() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final ride = await _repo.getCurrentRide();
      final current = state.activeRide;
      
      // RECONCILIATION GUARD: HTTP snapshot must not overwrite newer WebSocket state
      if (ride != null && current != null) {
        if (ride.id == current.id && ride.stateVersion < current.stateVersion) {
          state = state.copyWith(isLoading: false);
          return; // Ignore stale HTTP response
        }
      }
      state = state.copyWith(activeRide: ride, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to recover ride state.');
    }
  }

  void onWebSocketEvent(Map<String, dynamic> payload) {
    try {
      final incomingRide = Ride.fromJson(payload);
      final current = state.activeRide;
      
      if (current != null) {
        if (incomingRide.id != current.id) return; // Ignore different rides
        if (incomingRide.stateVersion <= current.stateVersion) return; // Ignore stale version
      }
      state = state.copyWith(activeRide: incomingRide);
    } catch (e) {
      // Safely ignore malformed WebSocket payloads without crashing
    }
  }

  Future<void> estimateFare(double pLat, double pLng, double dLat, double dLng, String serviceTypeId) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final estimate = await _repo.estimateFare(pLat, pLng, dLat, dLng, serviceTypeId);
      state = state.copyWith(isLoading: false, currentEstimate: estimate);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Failed to calculate fare estimate.');
    }
  }

  Future<void> requestRide(Map<String, dynamic> payload) async {
    final idempotencyKey = state.activeIdempotencyKey ?? const Uuid().v4();
    state = state.copyWith(isLoading: true, error: null, activeIdempotencyKey: idempotencyKey);
    
    try {
      final ride = await _repo.requestRide(payload, idempotencyKey);
      state = state.copyWith(activeRide: ride, isLoading: false, currentEstimate: null);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Network error. Please try again.');
    }
  }

  Future<void> cancelRide() async {
    final rideId = state.activeRide?.id;
    if (rideId == null) return;
    
    state = state.copyWith(isLoading: true);
    try {
      await _repo.cancelRide(rideId);
      // Backend mutation succeeds -> Clear local state
      state = RideState(); 
    } catch (e) {
      state = state.copyWith(isLoading: false, error: 'Cancellation failed.');
    }
  }
}
