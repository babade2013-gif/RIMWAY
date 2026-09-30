import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/config/app_settings.dart';
import '../../../shared/widgets/rimway_button.dart';
import '../application/captain_provider.dart';
import '../../auth/application/auth_provider.dart';
import 'captain_registration_screen.dart';

class CaptainRejectedScreen extends StatelessWidget {
  const CaptainRejectedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final captain = Provider.of<CaptainProvider>(context);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final appSettings = Provider.of<AppSettings>(context);
    final isArabic = appSettings.currentLocale.languageCode == 'ar';
    final reason = captain.rejectionReason ?? '';

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
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              Center(
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.cancel_outlined,
                    size: 54,
                    color: Colors.red.shade600,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                context.tr('status_rejected'),
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),

              // Rejection Reason Box (exact stored reason from Admin)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.tr('rejection_reason_label'),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: Colors.red.shade900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      reason.isNotEmpty ? reason : context.tr('unknown_error'),
                      style: TextStyle(
                        fontSize: 14,
                        color: Colors.red.shade800,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 36),

              RIMWayButton(
                text: context.tr('edit_and_resubmit'),
                onPressed: () {
                  Navigator.of(context).pushReplacement(MaterialPageRoute(
                    builder: (_) => const CaptainRegistrationScreen(),
                  ));
                },
              ),
              const SizedBox(height: 16),
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
