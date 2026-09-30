import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../application/captain_provider.dart';
import 'widgets/captain_drawer.dart';
import 'captain_wallet_screen.dart';

import 'widgets/incoming_ride_bottom_sheet.dart';
import 'widgets/active_ride_panel.dart';

class CaptainHomeScreen extends StatefulWidget {
  const CaptainHomeScreen({super.key});

  @override
  State<CaptainHomeScreen> createState() => _CaptainHomeScreenState();
}

class _CaptainHomeScreenState extends State<CaptainHomeScreen> {
  final MapController _mapController = MapController();
  LatLng? _lastKnownLocation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CaptainProvider>().fetchRegistrationStatus();
      context.read<CaptainProvider>().fetchWallet();
      context.read<CaptainProvider>().fetchCurrentRide();
    });
  }

  void _handleActiveRideAction(CaptainProvider captain) {
    if (captain.activeRideState == null) return;
    switch (captain.activeRideState!.status) {
      case 'DRIVER_ASSIGNED':
        captain.arriveAtPickup();
        break;
      case 'DRIVER_ARRIVED':
        captain.passengerBoarded();
        break;
      case 'PASSENGER_BOARDED':
        captain.startRide();
        break;
      case 'IN_PROGRESS':
        captain.completeRide();
        break;
      case 'COMPLETED':
        captain.acknowledgeCompletedRide();
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final captain = context.watch<CaptainProvider>();

    // Update map center gently if location changes and we don't have an active ride grabbing focus
    if (captain.currentLocation != null) {
      final newLoc = LatLng(captain.currentLocation!['lat']!, captain.currentLocation!['lng']!);
      if (_lastKnownLocation == null) {
        _lastKnownLocation = newLoc;
      } else {
        // Just store it, we don't force camera pan on every tick to let user pan freely
        _lastKnownLocation = newLoc;
      }
    }

    // Nouakchott fallback
    final initialCenter = _lastKnownLocation ?? const LatLng(18.0735, -15.9582);

    List<Marker> _buildMarkers() {
      final markers = <Marker>[];

      // Captain Marker
      if (captain.currentLocation != null) {
        markers.add(
          Marker(
            point: LatLng(captain.currentLocation!['lat']!, captain.currentLocation!['lng']!),
            width: 40,
            height: 40,
            child: Container(
              decoration: BoxDecoration(
                color: AppTheme.primaryColor.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(Icons.drive_eta, color: AppTheme.primaryColor, size: 24),
              ),
            ),
          ),
        );
      }

      // Ride Markers
      if (captain.activeRideModel != null) {
        final ride = captain.activeRideModel!;
        if (ride.pickupLat != null && ride.pickupLng != null) {
          markers.add(
            Marker(
              point: LatLng(ride.pickupLat!, ride.pickupLng!),
              width: 40,
              height: 40,
              child: const Icon(Icons.person_pin_circle, color: Colors.green, size: 40),
            ),
          );
        }
        if (ride.dropoffLat != null && ride.dropoffLng != null) {
          markers.add(
            Marker(
              point: LatLng(ride.dropoffLat!, ride.dropoffLng!),
              width: 40,
              height: 40,
              child: const Icon(Icons.location_on, color: Colors.red, size: 40),
            ),
          );
        }
      } else if (captain.incomingRideRequest != null) {
        final req = captain.incomingRideRequest!;
        if (req['lat'] != null && req['lng'] != null) {
           markers.add(
            Marker(
              point: LatLng(
                req['lat'] is num ? (req['lat'] as num).toDouble() : (double.tryParse(req['lat']?.toString() ?? '0') ?? 0.0),
                req['lng'] is num ? (req['lng'] as num).toDouble() : (double.tryParse(req['lng']?.toString() ?? '0') ?? 0.0),
              ),
              width: 40,
              height: 40,
              child: const Icon(Icons.person_pin_circle, color: Colors.orange, size: 40),
            ),
          );
        }
      }

      return markers;
    }

    return Scaffold(
      drawer: const CaptainDrawer(),
      body: Stack(
        children: [
          // 1. MAP LAYER
          Positioned.fill(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: initialCenter,
                initialZoom: 14.0,
                onMapReady: () {
                  if (_lastKnownLocation != null) {
                    _mapController.move(_lastKnownLocation!, 14.0);
                  }
                },
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.rimway.app',
                ),
                MarkerLayer(
                  markers: _buildMarkers(),
                ),
              ],
            ),
          ),

          // 2. RE-CENTER BUTTON
          if (captain.currentLocation != null)
            Positioned(
              right: 16,
              bottom: (captain.activeRideState != null || captain.incomingRideRequest != null) ? 320 : 32,
              child: FloatingActionButton(
                backgroundColor: Colors.white,
                onPressed: () {
                  _mapController.move(
                    LatLng(captain.currentLocation!['lat']!, captain.currentLocation!['lng']!), 
                    15.0
                  );
                },
                child: const Icon(Icons.my_location, color: Colors.black87),
              ),
            ),

          // 3. TOP BAR LAYER
          Positioned(
            top: 50,
            left: 16,
            right: 16,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Menu Button
                Builder(
                  builder: (ctx) => InkWell(
                    onTap: () => Scaffold.of(ctx).openDrawer(),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4)],
                      ),
                      child: const Icon(Icons.menu, color: Colors.black87),
                    ),
                  ),
                ),

                // Online/Offline Toggle
                InkWell(
                  onTap: captain.isLoading ? null : () => captain.toggleOnlineStatus(),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                    decoration: BoxDecoration(
                      color: captain.isOnline ? Colors.green : Colors.white,
                      borderRadius: BorderRadius.circular(30),
                      boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 4)],
                    ),
                    child: captain.isLoading
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text(
                            captain.isOnline ? context.tr('online') : context.tr('offline'),
                            style: TextStyle(
                              color: captain.isOnline ? Colors.white : Colors.black87,
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                            ),
                          ),
                  ),
                ),
                
                const SizedBox(width: 48), // Spacer to center the toggle
              ],
            ),
          ),

          // 3b. WALLET EXHAUSTED BANNER LAYER
          if (captain.isWalletExhausted && captain.activeRideState == null)
            Positioned(
              top: 115,
              left: 16,
              right: 16,
              child: InkWell(
                onTap: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CaptainWalletScreen()),
                  );
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.red.shade700,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6, offset: Offset(0, 2))],
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 24),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          context.tr('wallet_exhausted_warning'),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios, color: Colors.white70, size: 14),
                    ],
                  ),
                ),
              ),
            ),
          
          // 4. ERROR MESSAGE
          if (captain.errorMessage != null)
            Positioned(
              top: 120, left: 16, right: 16,
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(8)),
                child: Text(
                  context.tr(captain.errorMessage!),
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ),
            
          // 5. INCOMING RIDE REQUEST LAYER
          if (captain.incomingRideRequest != null && captain.activeRideState == null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: IncomingRideBottomSheet(
                request: captain.incomingRideRequest!,
                captainLocation: captain.currentLocation,
                onAccept: () => captain.acceptRide(captain.incomingRideRequest!['rideId']),
                onReject: () => captain.rejectIncomingRide(),
                isLoading: captain.isLoading,
              ),
            ),

          // 6. ACTIVE RIDE LAYER
          if (captain.activeRideState != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: ActiveRidePanel(
                rideState: captain.activeRideState!,
                rideModel: captain.activeRideModel,
                isLoading: captain.isLoading,
                onAction: () => _handleActiveRideAction(captain),
                onCancel: (reason) => captain.cancelRide(reason: reason),
              ),
            ),
        ],
      ),
    );
  }
}
