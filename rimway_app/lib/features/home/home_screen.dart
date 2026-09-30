import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../ride/application/ride_provider.dart';
import '../captain/application/captain_provider.dart' show LocationService;
import '../../../core/localization/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/rimway_button.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final MapController _mapController = MapController();
  final LocationService _locationService = LocationService();

  final TextEditingController _pickupCtrl = TextEditingController();
  final TextEditingController _dropoffCtrl = TextEditingController();

  LatLng _pickupLoc = const LatLng(18.0735, -15.9582); // Default Nouakchott
  LatLng? _dropoffLoc;
  bool _showEstimate = false;

  @override
  void initState() {
    super.initState();
    _pickupCtrl.text = 'موقعي الحالي';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initUserLocation();
      context.read<RideProvider>().fetchServiceTypes();
    });
  }

  Future<void> _initUserLocation() async {
    try {
      final loc = await _locationService.getCurrentLocation();
      if (loc != null && mounted) {
        final pos = LatLng(loc['lat']!, loc['lng']!);
        setState(() {
          _pickupLoc = pos;
        });
        _mapController.move(pos, 15.0);
      }
    } catch (_) {
      // Permission denied or GPS off; fallback to default Nouakchott coordinates
    }
  }

  @override
  void dispose() {
    _pickupCtrl.dispose();
    _dropoffCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleMapTap(LatLng point) async {
    setState(() {
      _dropoffLoc = point;
      _dropoffCtrl.text =
          '${point.latitude.toStringAsFixed(4)}, ${point.longitude.toStringAsFixed(4)}';
      _showEstimate = false;
    });

    final ride = context.read<RideProvider>();
    await _estimate(ride);
  }

  Future<void> _estimate(RideProvider ride) async {
    if (_dropoffLoc == null) {
      // If user typed without clicking map, assign an offset point
      _dropoffLoc = LatLng(_pickupLoc.latitude + 0.015, _pickupLoc.longitude + 0.015);
      _dropoffCtrl.text =
          '${_dropoffLoc!.latitude.toStringAsFixed(4)}, ${_dropoffLoc!.longitude.toStringAsFixed(4)}';
    }

    setState(() => _showEstimate = false);
    final ok = await ride.estimateRide(
      pickupLat: _pickupLoc.latitude,
      pickupLng: _pickupLoc.longitude,
      dropoffLat: _dropoffLoc!.latitude,
      dropoffLng: _dropoffLoc!.longitude,
      serviceTypeId: ride.selectedServiceType?.id,
    );
    if (ok && mounted) {
      setState(() => _showEstimate = true);
    }
  }

  Future<void> _requestRide(RideProvider ride) async {
    if (_dropoffLoc == null) return;
    await ride.requestRide(
      pickupLat: _pickupLoc.latitude,
      pickupLng: _pickupLoc.longitude,
      dropoffLat: _dropoffLoc!.latitude,
      dropoffLng: _dropoffLoc!.longitude,
      pickupAddress: _pickupCtrl.text.trim().isNotEmpty
          ? _pickupCtrl.text.trim()
          : 'Pickup Location',
      dropoffAddress: _dropoffCtrl.text.trim().isNotEmpty
          ? _dropoffCtrl.text.trim()
          : 'Destination Location',
      serviceTypeId: ride.selectedServiceType?.id,
    );
  }

  List<Marker> _buildMarkers() {
    final markers = <Marker>[];

    // Pickup Marker (Green)
    markers.add(
      Marker(
        point: _pickupLoc,
        width: 44,
        height: 44,
        child: Container(
          decoration: BoxDecoration(
            color: AppTheme.primaryColor.withValues(alpha: 0.2),
            shape: BoxShape.circle,
          ),
          child: const Center(
            child: Icon(Icons.my_location, color: AppTheme.primaryColor, size: 28),
          ),
        ),
      ),
    );

    // Dropoff Marker (Red)
    if (_dropoffLoc != null) {
      markers.add(
        Marker(
          point: _dropoffLoc!,
          width: 44,
          height: 44,
          child: const Icon(Icons.location_on, color: Colors.red, size: 40),
        ),
      );
    }

    return markers;
  }

  @override
  Widget build(BuildContext context) {
    final ride = context.watch<RideProvider>();
    final tr = context.tr;

    return Scaffold(
      body: Stack(
        children: [
          // 1. MAP-FIRST LAYER
          Positioned.fill(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _pickupLoc,
                initialZoom: 14.0,
                onTap: (_, point) => _handleMapTap(point),
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

          // 2. RE-CENTER GPS BUTTON
          Positioned(
            right: 16,
            bottom: _showEstimate ? 360 : 280,
            child: FloatingActionButton.small(
              backgroundColor: Colors.white,
              onPressed: () {
                _initUserLocation();
                _mapController.move(_pickupLoc, 15.0);
              },
              child: const Icon(Icons.gps_fixed, color: AppTheme.primaryColor),
            ),
          ),

          // 3. CONTEXTUAL BOTTOM SHEET OVERLAY
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black12,
                    blurRadius: 16,
                    offset: Offset(0, -4),
                  ),
                ],
              ),
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Drag Handle
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Locations Box
                  Container(
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: Column(
                      children: [
                        // Pickup
                        Row(
                          children: [
                            const Icon(Icons.circle, size: 12, color: AppTheme.primaryColor),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextField(
                                controller: _pickupCtrl,
                                style: const TextStyle(fontSize: 14),
                                decoration: InputDecoration(
                                  hintText: tr('pickup_location'),
                                  border: InputBorder.none,
                                  isDense: true,
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.my_location, size: 18, color: Colors.grey),
                              onPressed: _initUserLocation,
                            ),
                          ],
                        ),
                        const Divider(height: 1),
                        // Dropoff
                        Row(
                          children: [
                            const Icon(Icons.location_on, size: 18, color: Colors.red),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextField(
                                controller: _dropoffCtrl,
                                style: const TextStyle(fontSize: 14),
                                decoration: InputDecoration(
                                  hintText: tr('enter_destination'),
                                  border: InputBorder.none,
                                  isDense: true,
                                ),
                                onSubmitted: (val) {
                                  if (val.trim().isNotEmpty) {
                                    _estimate(ride);
                                  }
                                },
                              ),
                            ),
                            if (_dropoffLoc != null)
                              IconButton(
                                icon: const Icon(Icons.clear, size: 18, color: Colors.grey),
                                onPressed: () {
                                  setState(() {
                                    _dropoffLoc = null;
                                    _dropoffCtrl.clear();
                                    _showEstimate = false;
                                  });
                                },
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Service Types Selector (if available)
                  if (ride.serviceTypes.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 40,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        itemCount: ride.serviceTypes.length,
                        separatorBuilder: (_, __) => const SizedBox(width: 8),
                        itemBuilder: (context, idx) {
                          final st = ride.serviceTypes[idx];
                          final isSelected = ride.selectedServiceType?.id == st.id;
                          return InkWell(
                            onTap: () {
                              ride.selectServiceType(st);
                              if (_dropoffLoc != null) _estimate(ride);
                            },
                            borderRadius: BorderRadius.circular(20),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? AppTheme.primaryColor
                                    : Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(20),
                                border: Border.all(
                                  color: isSelected
                                      ? AppTheme.primaryColor
                                      : Colors.grey.shade300,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  st.name,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                    color: isSelected ? Colors.white : Colors.black87,
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ],

                  // Live Estimate Banner
                  if (_showEstimate && ride.estimate != null) ...[
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryColor.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppTheme.primaryColor.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                tr('estimated_fare'),
                                style: const TextStyle(fontSize: 12, color: Colors.grey),
                              ),
                              Text(
                                '${ride.estimate!.estimatedFare.toStringAsFixed(0)} ${tr('mru')}',
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.bold,
                                  color: AppTheme.primaryColor,
                                ),
                              ),
                            ],
                          ),
                          const Spacer(),
                          if (ride.estimate!.distanceKm > 0)
                            Text(
                              '${ride.estimate!.distanceKm.toStringAsFixed(1)} ${tr('km')}',
                              style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                            ),
                        ],
                      ),
                    ),
                  ],

                  // Error Display
                  if (ride.errorMessage != null && ride.flowState == RideFlowState.error) ...[
                    const SizedBox(height: 8),
                    Text(
                      tr(ride.errorMessage!),
                      style: const TextStyle(color: Colors.red, fontSize: 13),
                      textAlign: TextAlign.center,
                    ),
                  ],

                  const SizedBox(height: 16),

                  // Action Button
                  if (ride.flowState == RideFlowState.estimating)
                    const Center(child: CircularProgressIndicator())
                  else if (!_showEstimate || ride.estimate == null)
                    RIMWayButton(
                      text: tr('estimate_ride'),
                      onPressed: () => _estimate(ride),
                      isLoading: ride.flowState == RideFlowState.requesting,
                    )
                  else
                    RIMWayButton(
                      text: ride.flowState == RideFlowState.requesting
                          ? tr('requesting')
                          : tr('request_ride'),
                      onPressed: () => _requestRide(ride),
                      isLoading: ride.flowState == RideFlowState.requesting,
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
