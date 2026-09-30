import 'dart:async';

class RideState {
  final String rideId;
  final String status;
  final int stateVersion;
  
  const RideState({
    required this.rideId,
    required this.status,
    required this.stateVersion,
  });

  RideState copyWith({String? status, int? stateVersion}) {
    return RideState(
      rideId: rideId,
      status: status ?? this.status,
      stateVersion: stateVersion ?? this.stateVersion,
    );
  }
}

class RideSynchronizer {
  RideState? _currentRide;
  
  final _stateController = StreamController<RideState?>.broadcast();
  Stream<RideState?> get rideStateStream => _stateController.stream;

  RideState? get currentRide => _currentRide;

  /// Call this when syncing from REST API (e.g. GET /current)
  void syncFromRest(Map<String, dynamic> payload) {
    if (payload['status'] == 'NO_RIDE_FOUND' || payload['id'] == null) {
      _currentRide = null;
      _stateController.add(null);
      return;
    }

    final newVersion = payload['stateVersion'] as int;
    _applyUpdate(
      rideId: payload['id'],
      status: payload['status'],
      version: newVersion,
    );
  }

  /// Call this when receiving WS event 'ride_status_changed'
  void syncFromWebSocket(Map<String, dynamic> payload) {
    final rideId = payload['rideId'] ?? payload['id'];
    if (rideId == null) return;
    
    final newVersion = payload['stateVersion'] as int;
    _applyUpdate(
      rideId: rideId,
      status: payload['status'],
      version: newVersion,
    );
  }

  void _applyUpdate({required String rideId, required String status, required int version}) {
    // If no ride is active, or a new ride is started, accept directly
    if (_currentRide == null || _currentRide!.rideId != rideId) {
      _currentRide = RideState(rideId: rideId, status: status, stateVersion: version);
      _stateController.add(_currentRide);
      return;
    }

    // STRICT VERSION CHECK
    if (version > _currentRide!.stateVersion) {
      _currentRide = _currentRide!.copyWith(status: status, stateVersion: version);
      _stateController.add(_currentRide);
    } else {
      // Ignore stale updates (version <= currentLocal)
      print('SYNC IGNORED: incoming version $version <= current ${_currentRide!.stateVersion}');
    }
  }

  void clear() {
    _currentRide = null;
    _stateController.add(null);
  }
}
