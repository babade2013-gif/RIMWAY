import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/localization/app_localizations.dart';
import '../features/home/home_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/settings/settings_screen.dart';
import '../features/ride/application/ride_provider.dart';
import '../features/ride/presentation/ride_status_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    HomeScreen(),
    SettingsScreen(),
    ProfileScreen(),
  ];

  @override
  void initState() {
    super.initState();
    // Restore any active ride on app start
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<RideProvider>().checkActiveRide();
    });
  }

  @override
  Widget build(BuildContext context) {
    final ride = context.watch<RideProvider>();

    // If a ride is active (not idle), show the full-screen ride status
    final isRideActive = ride.flowState != RideFlowState.idle &&
        ride.flowState != RideFlowState.estimating;

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'RIM WAY',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
            color: Colors.white,
          ),
        ),
        actions: isRideActive
            ? null
            : [
                IconButton(
                  icon: const Icon(Icons.notifications_none,
                      color: Colors.white),
                  onPressed: () {},
                ),
              ],
      ),
      body: isRideActive
          ? const RideStatusScreen()
          : _screens[_currentIndex],
      bottomNavigationBar: isRideActive
          ? null
          : BottomNavigationBar(
              currentIndex: _currentIndex,
              onTap: (index) => setState(() => _currentIndex = index),
              type: BottomNavigationBarType.fixed,
              selectedItemColor: const Color(0xFF00796B),
              unselectedItemColor: Colors.grey,
              items: [
                BottomNavigationBarItem(
                    icon: const Icon(Icons.home),
                    label: context.tr('home')),
                BottomNavigationBarItem(
                    icon: const Icon(Icons.settings),
                    label: context.tr('settings')),
                BottomNavigationBarItem(
                    icon: const Icon(Icons.person),
                    label: context.tr('profile')),
              ],
            ),
    );
  }
}
