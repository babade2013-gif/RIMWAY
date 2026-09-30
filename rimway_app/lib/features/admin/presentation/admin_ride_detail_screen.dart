import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../application/admin_provider.dart';
import '../../../core/localization/app_localizations.dart';

class AdminRideDetailScreen extends StatefulWidget {
  final String rideId;
  const AdminRideDetailScreen({super.key, required this.rideId});

  @override
  State<AdminRideDetailScreen> createState() => _AdminRideDetailScreenState();
}

class _AdminRideDetailScreenState extends State<AdminRideDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AdminProvider>().fetchRideDetails(widget.rideId);
    });
  }

  bool _canCancel(String status) {
    const cancellableStates = [
      'SEARCHING',
      'DRIVER_ASSIGNED',
      'DRIVER_ARRIVED',
      'PASSENGER_BOARDED',
      'IN_PROGRESS'
    ];
    return cancellableStates.contains(status);
  }

  void _showCancelDialog() {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('cancel_ride')),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(
            labelText: context.tr('reason'),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('close')),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await context.read<AdminProvider>().cancelRide(controller.text);
              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Ride cancelled successfully')),
                );
              } else if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Failed to cancel ride')),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: Text(context.tr('confirm')),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AdminProvider>();
    final ride = provider.selectedRide;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('ride_details')),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => provider.fetchRideDetails(widget.rideId),
          ),
        ],
      ),
      body: _buildBody(provider),
      bottomNavigationBar: (ride != null && _canCancel(ride.status))
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: ElevatedButton(
                  onPressed: _showCancelDialog,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: Text(context.tr('cancel_ride'), style: const TextStyle(color: Colors.white)),
                ),
              ),
            )
          : null,
    );
  }

  Widget _buildBody(AdminProvider provider) {
    if (provider.state == AdminState.loading && provider.selectedRide == null) {
      return const Center(child: CircularProgressIndicator());
    }
    
    final ride = provider.selectedRide;
    if (ride == null) {
      return const Center(child: Text('Ride details not found.'));
    }

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _buildInfoCard(
          title: context.tr('status'),
          content: ride.status,
        ),
        _buildInfoCard(
          title: context.tr('customer'),
          content: '${ride.customerName ?? ride.passengerName ?? 'Unknown'}\n${ride.customerPhone ?? ride.passengerPhone ?? ''}',
        ),
        _buildInfoCard(
          title: context.tr('locations'),
          content: 'From: ${ride.pickupAddress ?? 'Unknown'}\nTo: ${ride.dropoffAddress ?? 'Unknown'}',
        ),
        _buildInfoCard(
          title: context.tr('fare'),
          content: 'Estimated: ${ride.estimatedFare} MRU\nFinal: ${ride.finalFare != null ? '${ride.finalFare} MRU' : 'Pending'}',
        ),
      ],
    );
  }

  Widget _buildInfoCard({required String title, required String content}) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            const SizedBox(height: 8),
            Text(content, style: const TextStyle(fontSize: 14)),
          ],
        ),
      ),
    );
  }
}
