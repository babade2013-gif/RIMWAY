import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/config/app_settings.dart';
import '../../../shared/widgets/rimway_button.dart';
import '../../../shared/widgets/rimway_text_field.dart';
import '../application/auth_provider.dart';
import 'otp_screen.dart';
import '../../captain/presentation/captain_start_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _phoneController = TextEditingController();

  void _submit() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final phone = _phoneController.text.trim();
    
    // Auto-format for Mauritania if user forgot +222
    String formattedPhone = phone;
    if (!formattedPhone.startsWith('+222') && formattedPhone.length == 8) {
      formattedPhone = '+222$formattedPhone';
    }

    final success = await auth.sendOtp(formattedPhone);
    if (success && mounted) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => const OtpScreen(role: 'PASSENGER'),
      ));
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final appSettings = Provider.of<AppSettings>(context);
    final isArabic = appSettings.currentLocale.languageCode == 'ar';
    
    return Scaffold(
      appBar: AppBar(
        title: const Text('RIM WAY'),
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.language, size: 18, color: Colors.white),
            label: Text(
              isArabic ? 'Français' : 'العربية',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
            onPressed: () {
              appSettings.changeLanguage(isArabic ? 'fr' : 'ar');
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                context.tr('welcome_back'),
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),
              RIMWayTextField(
                hintText: context.tr('phone_hint'),
                controller: _phoneController,
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 16),
              if (auth.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Text(
                    context.tr(auth.errorMessage!),
                    style: const TextStyle(color: Colors.red),
                    textAlign: TextAlign.center,
                  ),
                ),
              RIMWayButton(
                text: context.tr('send_otp'),
                onPressed: _submit,
                isLoading: auth.isLoading,
              ),
              const SizedBox(height: 32),
              const Divider(),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  foregroundColor: AppTheme.primaryColor,
                  side: const BorderSide(color: AppTheme.primaryColor),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.drive_eta),
                label: Text(
                  context.tr('login_as_captain'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                onPressed: () {
                  Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => const CaptainStartScreen(),
                  ));
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
