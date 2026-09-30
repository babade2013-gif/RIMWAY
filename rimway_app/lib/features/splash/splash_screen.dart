import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/localization/app_localizations.dart';
import '../auth/application/auth_provider.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  void _checkAuth() async {
    // Artificial delay for splash branding UX
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) {
      Provider.of<AuthProvider>(context, listen: false).checkAuthStatus();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.primaryColor,
      body: Center(
        child: Text(
          context.tr('app_name'), // Will strictly render 'RIM WAY'
          style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold, color: Colors.white),
        ),
      ),
    );
  }
}
