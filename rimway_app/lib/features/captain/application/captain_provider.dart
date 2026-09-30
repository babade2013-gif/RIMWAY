import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:audioplayers/audioplayers.dart';
import '../data/captain_repository.dart';
import 'dart:async';

import 'package:geolocator/geolocator.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/websocket/ws_client.dart';
import '../../ride/domain/ride_synchronizer.dart';
import '../../ride/data/ride_repository.dart';

class LocationService {
  final GeolocatorPlatform geolocator;

  LocationService({GeolocatorPlatform? geolocator})
      : geolocator = geolocator ?? GeolocatorPlatform.instance;

  Future<Map<String, double>?> getCurrentLocation() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      throw ApiException(message: 'location_service_disabled', errorType: 'GPS_ERROR');
    }

    permission = await geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        throw ApiException(message: 'location_permission_denied', errorType: 'GPS_ERROR');
      }
    }

    if (permission == LocationPermission.deniedForever) {
      throw ApiException(message: 'location_permission_permanently_denied', errorType: 'GPS_ERROR');
    }

    final position = await geolocator.getCurrentPosition();
    return {'lat': position.latitude, 'lng': position.longitude};
  }
}

enum CaptainRegistrationStatus {
  unknown,
  incomplete,
  pendingReview,
  approved,
  rejected,
  suspended,
}

class CaptainProvider extends ChangeNotifier {
  final CaptainRepository repository;
  final LocationService locationService;
  final WsClient? wsClient;
  final RideSynchronizer? rideSynchronizer;
  
  bool _isOnline = false;
  bool get isOnline => _isOnline;
  
  bool _isLoading = false;
  bool get isLoading => _isLoading;
  
  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  CaptainRegistrationStatus _registrationStatus = CaptainRegistrationStatus.unknown;
  CaptainRegistrationStatus get registrationStatus => _registrationStatus;

  String? _rejectionReason;
  String? get rejectionReason => _rejectionReason;

  Map<String, dynamic>? _driverProfile;
  Map<String, dynamic>? get driverProfile => _driverProfile;

  String? get captainName => (_driverProfile?['user']?['name'] as String?) ?? (_driverProfile?['name'] as String?);
  String? get captainPhone => (_driverProfile?['user']?['phone'] as String?) ?? (_driverProfile?['phone'] as String?);
  String? get captainPhoto => (_driverProfile?['user']?['photo'] as String?) ?? (_driverProfile?['photo'] as String?);
  static double _safeDouble(dynamic val, [double defaultValue = 0.0]) {
    if (val == null) return defaultValue;
    if (val is num) return val.toDouble();
    if (val is String) return double.tryParse(val) ?? defaultValue;
    return defaultValue;
  }

  double get walletBalance => _safeDouble(_driverProfile?['walletBalance'], 0.0);
  double get rating => _safeDouble(_driverProfile?['rating'], 5.0);
  bool get isWalletExhausted => walletBalance <= 0;

  List<dynamic> _walletTransactions = [];
  List<dynamic> get walletTransactions => _walletTransactions;

  bool _walletLoading = false;
  bool get walletLoading => _walletLoading;

  List<ServiceTypeModel> _availableServices = [];
  List<ServiceTypeModel> get availableServices => _availableServices;

  Timer? _locationTimer;
  StreamSubscription? _wsSubscription;
  StreamSubscription? _rideStateSubscription;

  // Incoming request state
  Map<String, dynamic>? _incomingRideRequest;
  Map<String, dynamic>? get incomingRideRequest => _incomingRideRequest;

  // Active ride state (authoritative from Synchronizer)
  RideState? get activeRideState => rideSynchronizer?.currentRide;
  
  // The full ride model (when available)
  RideModel? _activeRideModel;
  RideModel? get activeRideModel => _activeRideModel;

  Map<String, double>? _currentLocation;
  Map<String, double>? get currentLocation => _currentLocation;

  CaptainProvider({
    required this.repository, 
    required this.locationService,
    this.wsClient,
    this.rideSynchronizer,
  }) {
    _initSubscriptions();
  }

  void _initSubscriptions() {
    _wsSubscription = wsClient?.rideEvents.listen((event) {
      if (event['event_type'] == 'ride_requested') {
        _handleIncomingRide(event);
      }
    });

    _rideStateSubscription = rideSynchronizer?.rideStateStream.listen((state) {
      if (state == null) {
        _activeRideModel = null;
      } else {
        _stopIncomingRideAlert();
      }
      notifyListeners();
    });
  }

  AudioPlayer? _audioPlayer;
  AudioPlayer get audioPlayer => _audioPlayer ??= AudioPlayer();
  Timer? _alertHapticTimer;

  Future<void> _playIncomingRideAlert() async {
    try {
      HapticFeedback.heavyImpact().catchError((_) {});
    } catch (_) {}

    _alertHapticTimer?.cancel();
    _alertHapticTimer = Timer.periodic(const Duration(milliseconds: 1500), (_) {
      if (_incomingRideRequest != null && activeRideState == null) {
        try {
          HapticFeedback.heavyImpact().catchError((_) {});
          SystemSound.play(SystemSoundType.alert).catchError((_) {});
        } catch (_) {}
      } else {
        _alertHapticTimer?.cancel();
        _alertHapticTimer = null;
      }
    });

    try {
      await audioPlayer.stop();
      await audioPlayer.setReleaseMode(ReleaseMode.loop);
      await audioPlayer.play(AssetSource('sounds/ride_alert.wav'), volume: 1.0);
    } catch (_) {
      try {
        await SystemSound.play(SystemSoundType.alert);
      } catch (_) {}
    }
  }

  Future<void> _stopIncomingRideAlert() async {
    _alertHapticTimer?.cancel();
    _alertHapticTimer = null;
    try {
      await audioPlayer.stop();
    } catch (_) {}
  }

  void _handleIncomingRide(Map<String, dynamic> data) {
    if (activeRideState != null) return;
    
    final rideId = data['rideId'];
    if (rideId == null) return;
    
    final cycleId = data['cycleId'];
    
    if (_incomingRideRequest != null) {
      if (_incomingRideRequest!['rideId'] == rideId &&
          _incomingRideRequest!['cycleId'] == cycleId) {
        return;
      }
    }
    
    _incomingRideRequest = data;
    _playIncomingRideAlert();
    notifyListeners();
  }

  void rejectIncomingRide() {
    _stopIncomingRideAlert();
    _incomingRideRequest = null;
    notifyListeners();
  }

  Future<void> acceptRide(String rideId) async {
    _stopIncomingRideAlert();
    if (_isLoading) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      final incomingPhone = _incomingRideRequest?['customerPhone'] as String?;
      final incomingName = _incomingRideRequest?['customerName'] as String?;
      final incomingPickup = _incomingRideRequest?['pickupName'] as String?;
      final incomingDropoff = _incomingRideRequest?['dropoffName'] as String?;
      final incomingFare = _safeDouble(_incomingRideRequest?['estimatedFare']);
      final incomingDistance = _safeDouble(_incomingRideRequest?['distanceKm']);
      final rawVersion = _incomingRideRequest?['stateVersion'];
      final expectedVersion = rawVersion is num
          ? rawVersion.toInt()
          : (int.tryParse(rawVersion?.toString() ?? '1') ?? 1);
      final rideModel = await repository.acceptRide(rideId, expectedVersion);
      _incomingRideRequest = null;
      _activeRideModel = rideModel.copyWith(
        passengerPhone: rideModel.passengerPhone ?? incomingPhone,
        customerPhone: rideModel.customerPhone ?? incomingPhone,
        passengerName: rideModel.passengerName ?? incomingName,
        customerName: rideModel.customerName ?? incomingName,
        pickupAddress: rideModel.pickupAddress ?? incomingPickup,
        dropoffAddress: rideModel.dropoffAddress ?? incomingDropoff,
        estimatedFare: rideModel.estimatedFare ?? incomingFare,
        distanceKm: rideModel.distanceKm ?? incomingDistance,
      );
      rideSynchronizer?.syncFromRest(_activeRideModel!.toJson());
    } on ApiException catch (e) {
      if (e.statusCode == 409) {
        _errorMessage = 'ride_no_longer_available';
      } else {
        _errorMessage = e.message;
      }
      _incomingRideRequest = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> arriveAtPickup() async {
    await _performRideAction((version) => repository.arriveAtPickup(activeRideState!.rideId, version));
  }

  Future<void> passengerBoarded() async {
    await _performRideAction((version) => repository.passengerBoarded(activeRideState!.rideId, version));
  }

  Future<void> startRide() async {
    await _performRideAction((version) => repository.startRide(activeRideState!.rideId, version));
  }

  Future<void> completeRide() async {
    await _performRideAction((version) => repository.completeRide(activeRideState!.rideId, version));
  }

  Future<void> cancelRide({String? reason}) async {
    if (_isLoading || activeRideState == null) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await repository.cancelRide(activeRideState!.rideId, activeRideState!.stateVersion, reason: reason);
      _activeRideModel = null;
      rideSynchronizer?.clear();
    } on ApiException catch (e) {
      if (e.statusCode == 409) {
        _errorMessage = 'ride_action_failed';
      } else {
        _errorMessage = e.message;
      }
    } catch (_) {
      _errorMessage = 'ride_action_failed';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchCurrentRide() async {
    _isLoading = true;
    notifyListeners();
    try {
      await wsClient?.connect();
      final rideModel = await repository.getCurrentRide();
      if (rideModel != null) {
        _activeRideModel = rideModel.copyWith(
          passengerPhone: rideModel.passengerPhone ?? _activeRideModel?.passengerPhone,
          customerPhone: rideModel.customerPhone ?? _activeRideModel?.customerPhone,
          passengerName: rideModel.passengerName ?? _activeRideModel?.passengerName,
          customerName: rideModel.customerName ?? _activeRideModel?.customerName,
          pickupAddress: rideModel.pickupAddress ?? _activeRideModel?.pickupAddress,
          dropoffAddress: rideModel.dropoffAddress ?? _activeRideModel?.dropoffAddress,
          estimatedFare: rideModel.estimatedFare ?? _activeRideModel?.estimatedFare,
          distanceKm: rideModel.distanceKm ?? _activeRideModel?.distanceKm,
        );
        rideSynchronizer?.syncFromRest(_activeRideModel!.toJson());
      } else {
        _activeRideModel = null;
        rideSynchronizer?.clear();
      }
    } catch (e) {
      // Ignore
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _performRideAction(Future<RideModel> Function(int version) action) async {
    if (_isLoading || activeRideState == null) return;
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final rideModel = await action(activeRideState!.stateVersion);
      _activeRideModel = rideModel.copyWith(
        passengerPhone: rideModel.passengerPhone ?? _activeRideModel?.passengerPhone,
        customerPhone: rideModel.customerPhone ?? _activeRideModel?.customerPhone,
        passengerName: rideModel.passengerName ?? _activeRideModel?.passengerName,
        customerName: rideModel.customerName ?? _activeRideModel?.customerName,
        pickupAddress: rideModel.pickupAddress ?? _activeRideModel?.pickupAddress,
        dropoffAddress: rideModel.dropoffAddress ?? _activeRideModel?.dropoffAddress,
        estimatedFare: rideModel.estimatedFare ?? _activeRideModel?.estimatedFare,
        distanceKm: rideModel.distanceKm ?? _activeRideModel?.distanceKm,
      );
      rideSynchronizer?.syncFromRest(_activeRideModel!.toJson());
    } on ApiException catch (e) {
      if (e.statusCode == 409) {
        _errorMessage = 'ride_action_failed';
      } else {
        _errorMessage = e.message;
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> toggleOnlineStatus() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final newStatus = !_isOnline;
      await repository.setStatus(newStatus);
      _isOnline = newStatus;
      
      if (_isOnline) {
        _startLocationUpdates();
      } else {
        _stopLocationUpdates();
      }
    } catch (e) {
      _errorMessage = 'Failed to update status';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void _startLocationUpdates() {
    _locationTimer?.cancel();
    
    // Fetch immediately
    _fetchAndSendLocation();

    // Then periodically
    _locationTimer = Timer.periodic(const Duration(seconds: 15), (timer) {
      _fetchAndSendLocation();
    });
  }

  Future<void> _fetchAndSendLocation() async {
    try {
      final location = await locationService.getCurrentLocation();
      if (location != null) {
        _currentLocation = location;
        notifyListeners();
        repository.updateLocation(location['lat']!, location['lng']!).catchError((_) {});
      }
    } on ApiException catch (e) {
      _errorMessage = e.message;
      _isOnline = false;
      _stopLocationUpdates();
      notifyListeners();
      repository.setStatus(false).catchError((_) {});
    } catch (e) {
      // Ignore other errors silently
    }
  }

  void _stopLocationUpdates() {
    _locationTimer?.cancel();
    _locationTimer = null;
  }

  void acknowledgeCompletedRide() {
    rideSynchronizer?.clear();
    _activeRideModel = null;
    notifyListeners();
  }

  Future<void> fetchRegistrationStatus() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final data = await repository.getMe();
      _driverProfile = data;
      _rejectionReason = data['rejectionReason'] as String?;

      final regStatus = data['registrationStatus'] as String? ?? 'REGISTRATION_INCOMPLETE';
      switch (regStatus) {
        case 'APPROVED':
          _registrationStatus = CaptainRegistrationStatus.approved;
          break;
        case 'PENDING_REVIEW':
          _registrationStatus = CaptainRegistrationStatus.pendingReview;
          break;
        case 'REJECTED':
          _registrationStatus = CaptainRegistrationStatus.rejected;
          break;
        case 'SUSPENDED':
          _registrationStatus = CaptainRegistrationStatus.suspended;
          break;
        case 'REGISTRATION_INCOMPLETE':
        default:
          _registrationStatus = CaptainRegistrationStatus.incomplete;
          break;
      }
      _isLoading = false;
      notifyListeners();
    } on ApiException catch (e) {
      _errorMessage = e.message;
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to fetch status';
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadServices() async {
    try {
      _availableServices = await repository.getServices();
      notifyListeners();
    } catch (e) {
      // Fallback
    }
  }

  Future<Map<String, dynamic>?> uploadFile(String filePath, {String category = 'documents'}) async {
    try {
      return await repository.uploadFile(filePath, category: category);
    } catch (e) {
      return null;
    }
  }

  Future<bool> submitRegistration(Map<String, dynamic> payload) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final res = await repository.submitRegistration(payload);
      _driverProfile = res;
      _registrationStatus = CaptainRegistrationStatus.pendingReview;
      _rejectionReason = null;
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'Failed to submit registration';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> fetchWallet() async {
    _walletLoading = true;
    notifyListeners();
    try {
      final res = await repository.getWallet();
      if (_driverProfile != null) {
        _driverProfile!['walletBalance'] = res['walletBalance'];
      }
      _walletTransactions = (res['transactions'] as List<dynamic>?) ?? [];
    } catch (_) {
      // Ignore
    } finally {
      _walletLoading = false;
      notifyListeners();
    }
  }

  Future<bool> submitTopUpRequest(double amount, {String? reference, String? notes}) async {
    _walletLoading = true;
    _errorMessage = null;
    notifyListeners();
    try {
      await repository.requestTopUp(amount, reference: reference, notes: notes);
      await fetchWallet();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      return false;
    } catch (_) {
      _errorMessage = 'failed_to_submit_top_up';
      return false;
    } finally {
      _walletLoading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _stopIncomingRideAlert();
    _wsSubscription?.cancel();
    _rideStateSubscription?.cancel();
    _stopLocationUpdates();
    _audioPlayer?.dispose();
    super.dispose();
  }
}
