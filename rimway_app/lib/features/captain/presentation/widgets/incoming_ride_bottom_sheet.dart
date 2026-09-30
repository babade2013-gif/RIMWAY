import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../shared/widgets/rimway_button.dart';

class IncomingRideBottomSheet extends StatelessWidget {
  final Map<String, dynamic> request;
  final Map<String, double>? captainLocation;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final bool isLoading;

  const IncomingRideBottomSheet({
    super.key,
    required this.request,
    this.captainLocation,
    required this.onAccept,
    required this.onReject,
    required this.isLoading,
  });

  // Haversine distance calculator in km
  double _calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
    const p = 0.017453292519943295; // Math.PI / 180
    final c = 0.5 -
        math.cos((lat2 - lat1) * p) / 2 +
        math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2;
    return 12742 * math.asin(math.sqrt(c));
  }

  @override
  Widget build(BuildContext context) {
    // 1. Extract Fare
    final fareVal = request['estimatedFare'] ?? request['fare'] ?? request['snapBaseFare'];
    final fareText = fareVal != null ? '${fareVal.toString()} MRU' : 'حسب العداد';

    // 2. Extract Locations
    final pickupName = request['pickupName'] ?? request['pickupAddress'] ?? 'نقطة الانطلاق';
    final dropoffName = request['dropoffName'] ?? request['dropoffAddress'] ?? 'وجهة الوصول';

    double? parseCoord(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      if (v is String) return double.tryParse(v);
      return null;
    }

    final pickupLat = parseCoord(request['pickupLat'] ?? request['lat']);
    final pickupLng = parseCoord(request['pickupLng'] ?? request['lng']);
    final dropoffLat = parseCoord(request['dropoffLat']);
    final dropoffLng = parseCoord(request['dropoffLng']);

    // 3. Distance to Customer (البعد عن الزبون)
    String distanceToCustomerText = 'قريب منك';
    if (captainLocation != null && pickupLat != null && pickupLng != null) {
      final capLat = captainLocation!['latitude'] ?? captainLocation!['lat'];
      final capLng = captainLocation!['longitude'] ?? captainLocation!['lng'];
      if (capLat != null && capLng != null) {
        final dist = _calculateDistanceKm(capLat, capLng, pickupLat, pickupLng);
        final mins = (dist / 30 * 60).round().clamp(1, 60);
        distanceToCustomerText = '${dist.toStringAsFixed(1)} كم (~$mins د)';
      }
    }

    // 4. Trip Distance (مسافة الرحلة)
    String tripDistanceText = 'مسافة الرحلة';
    if (request['distanceKm'] != null) {
      final dist = parseCoord(request['distanceKm']) ?? 0.0;
      tripDistanceText = '${dist.toStringAsFixed(1)} كم';
    } else if (pickupLat != null && pickupLng != null && dropoffLat != null && dropoffLng != null) {
      final dist = _calculateDistanceKm(pickupLat, pickupLng, dropoffLat, dropoffLng);
      tripDistanceText = '${dist.toStringAsFixed(1)} كم';
    } else {
      tripDistanceText = '~4.5 كم';
    }

    final serviceName = request['serviceName'] ?? 'Standard';
    final customerName = request['customerName'] ?? 'عميل RIM WAY';

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        boxShadow: [
          BoxShadow(
            color: Colors.black26,
            blurRadius: 16,
            spreadRadius: 4,
            offset: Offset(0, -4),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag Handle
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // 1. FARE & METRICS ROW (COMBINED)
          Row(
            children: [
              // Fare Box
              Container(
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF0F766E), Color(0xFF0D9488)],
                    begin: Alignment.topRight,
                    end: Alignment.bottomLeft,
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0F766E).withValues(alpha: 0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            serviceName,
                            style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.payments_outlined, color: Colors.white70, size: 14),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      fareText,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              // Metrics (Distance to customer & Trip distance)
              Expanded(
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.near_me, color: Colors.blue.shade700, size: 14),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'للزبون: $distanceToCustomerText',
                              style: TextStyle(color: Colors.blue.shade900, fontSize: 11, fontWeight: FontWeight.bold),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.route, color: Colors.amber.shade800, size: 14),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'المشوار: $tripDistanceText',
                              style: TextStyle(color: Colors.amber.shade900, fontSize: 11, fontWeight: FontWeight.bold),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),

          // 2. ROUTE DETAILS
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.circle, color: Color(0xFF10B981), size: 10),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              pickupName,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black87),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.location_on, color: Color(0xFFEF4444), size: 10),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              dropoffName,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black87),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (customerName.isNotEmpty) ...[
                  Container(
                    margin: const EdgeInsets.only(right: 8, left: 4),
                    width: 1,
                    height: 24,
                    color: Colors.grey.shade300,
                  ),
                  Column(
                    children: [
                      const Icon(Icons.person, size: 14, color: Colors.grey),
                      Text(
                        customerName,
                        style: const TextStyle(fontSize: 10, color: Colors.black54, fontWeight: FontWeight.bold),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 3. ACTION BUTTONS
          Row(
            children: [
              Expanded(
                flex: 2,
                child: OutlinedButton.icon(
                  onPressed: isLoading ? null : onReject,
                  icon: const Icon(Icons.close, size: 16),
                  label: const Text('رفض', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red.shade600,
                    side: BorderSide(color: Colors.red.shade300, width: 1.5),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 4,
                child: RIMWayButton(
                  text: context.tr('captain_accept_ride'),
                  onPressed: onAccept,
                  isLoading: isLoading,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
