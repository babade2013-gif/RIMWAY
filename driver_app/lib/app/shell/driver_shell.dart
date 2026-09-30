import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

// Note: Using hardcoded colors conceptually here to mirror design tokens logic 
// without relying on generated localization/theme imports in this raw snippet.
class DriverShell extends StatelessWidget {
  final Widget child;
  const DriverShell({Key? key, required this.child}) : super(key: key);

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    if (location.startsWith('/driver/home')) return 0;
    if (location.startsWith('/driver/trips')) return 1;
    if (location.startsWith('/driver/earnings')) return 2;
    if (location.startsWith('/driver/profile')) return 3;
    return 0;
  }

  void _onItemTapped(int index, BuildContext context) {
    switch (index) {
      case 0: context.go('/driver/home'); break;
      case 1: context.go('/driver/trips'); break;
      case 2: context.go('/driver/earnings'); break;
      case 3: context.go('/driver/profile'); break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _calculateSelectedIndex(context),
        onTap: (idx) => _onItemTapped(idx, context),
        selectedItemColor: const Color(0xFF0B192C), // AppColors.primary
        unselectedItemColor: const Color(0xFF64748B), // AppColors.textSecondary
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.map), label: 'الرئيسية'),
          BottomNavigationBarItem(icon: Icon(Icons.history), label: 'الرحلات'),
          BottomNavigationBarItem(icon: Icon(Icons.account_balance_wallet), label: 'الأرباح'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'حسابي'),
        ],
      ),
    );
  }
}
