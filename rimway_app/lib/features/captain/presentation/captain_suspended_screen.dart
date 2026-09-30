import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/config/app_settings.dart';
import '../../auth/application/auth_provider.dart';

class CaptainSuspendedScreen extends StatelessWidget {
  const CaptainSuspendedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final appSettings = Provider.of<AppSettings>(context);
    final isArabic = appSettings.currentLocale.languageCode == 'ar';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          context.tr('captain_portal'),
          style: const TextStyle(color: Colors.black87, fontWeight: FontWeight.bold),
        ),
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.language, size: 20, color: AppTheme.primaryColor),
            label: Text(
              isArabic ? 'Français' : 'العربية',
              style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
            ),
            onPressed: () {
              appSettings.changeLanguage(isArabic ? 'fr' : 'ar');
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.grey),
            tooltip: context.tr('logout'),
            onPressed: () => auth.forceLogout(),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.block,
                    size: 54,
                    color: Colors.red.shade700,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                context.tr('status_suspended'),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              Text(
                context.tr('suspended_msg'),
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade700,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 40),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.grey.shade700,
                  side: BorderSide(color: Colors.grey.shade300),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => auth.forceLogout(),
                child: Text(
                  context.tr('logout'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
