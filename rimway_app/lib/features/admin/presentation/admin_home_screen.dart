import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../application/admin_provider.dart';
import '../../../core/localization/app_localizations.dart';
import 'admin_ride_detail_screen.dart';
import 'admin_create_ride_screen.dart';
import '../../../features/auth/application/auth_provider.dart';

class AdminHomeScreen extends StatefulWidget {
  const AdminHomeScreen({super.key});

  @override
  State<AdminHomeScreen> createState() => _AdminHomeScreenState();
}

class _AdminHomeScreenState extends State<AdminHomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AdminProvider>().fetchRides();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AdminProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('admin_dashboard')),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => context.read<AdminProvider>().fetchRides(),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
        ],
      ),
      body: _buildBody(provider),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const AdminCreateRideScreen()),
          );
        },
        child: const Icon(Icons.add_ic_call),
      ),
    );
  }

  Widget _buildBody(AdminProvider provider) {
    if (provider.state == AdminState.loading && provider.rides.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    
    if (provider.state == AdminState.error && provider.rides.isEmpty) {
      return Center(
        child: Text(provider.errorMessage ?? 'Error loading rides'),
      );
    }

    if (provider.rides.isEmpty) {
      return Center(
        child: Text(context.tr('no_rides_found')),
      );
    }

    return ListView.builder(
      itemCount: provider.rides.length,
      itemBuilder: (context, index) {
        final ride = provider.rides[index];
        return Card(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: ListTile(
            title: Text('${context.tr('ride')} #${ride.id.substring(0, 8)}'),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${context.tr('status')}: ${ride.status}'),
                Text('${context.tr('customer')}: ${ride.customerName ?? ride.passengerName ?? 'N/A'}'),
              ],
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => AdminRideDetailScreen(rideId: ride.id),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
