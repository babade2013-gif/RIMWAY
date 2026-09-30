import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/config/app_settings.dart';
import '../../../shared/widgets/rimway_button.dart';
import '../../../shared/widgets/rimway_text_field.dart';
import '../../auth/application/auth_provider.dart';
import '../../auth/presentation/otp_screen.dart';

class CaptainStartScreen extends StatefulWidget {
  const CaptainStartScreen({super.key});

  @override
  State<CaptainStartScreen> createState() => _CaptainStartScreenState();
}

class _CaptainStartScreenState extends State<CaptainStartScreen> {
  bool _started = false;
  String _selectedCountryCode = '+222';
  final TextEditingController _phoneController = TextEditingController();
  bool _termsAccepted = false;

  final List<Map<String, String>> _countries = const [
    {'code': '+222', 'name': 'Mauritanie (موريتانيا)', 'flag': '🇲🇷'},
    {'code': '+221', 'name': 'Sénégal (السنغال)', 'flag': '🇸🇳'},
    {'code': '+223', 'name': 'Mali (مالي)', 'flag': '🇲🇱'},
    {'code': '+212', 'name': 'Maroc (المغرب)', 'flag': '🇲🇦'},
  ];

  bool get _isPhoneValid {
    final text = _phoneController.text.trim();
    if (_selectedCountryCode == '+222') {
      return text.length == 8 && RegExp(r'^[2-4][0-9]{7}$').hasMatch(text);
    }
    return text.length >= 8 && text.length <= 10;
  }

  bool get _canContinue => _termsAccepted && _isPhoneValid;

  void _onContinue() async {
    if (!_canContinue) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final rawPhone = _phoneController.text.trim();
    final fullPhone = '$_selectedCountryCode$rawPhone';

    final sent = await auth.sendOtp(fullPhone);
    if (sent && mounted) {
      Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => const OtpScreen(role: 'DRIVER'),
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
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.black87),
          onPressed: () => Navigator.of(context).maybePop(),
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
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 12),
              // Brand Logo & Captain Icon
              Center(
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.drive_eta,
                    size: 48,
                    color: AppTheme.primaryColor,
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Title & Subtitle
              Text(
                context.tr('join_captains'),
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                context.tr('join_captains_subtitle'),
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey.shade600,
                  height: 1.4,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              if (!_started) ...[
                // Initial Start Button
                const SizedBox(height: 24),
                RIMWayButton(
                  text: context.tr('start'),
                  onPressed: () {
                    setState(() {
                      _started = true;
                    });
                  },
                ),
              ] else ...[
                // Phone Entry Card
                Card(
                  elevation: 2,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  child: Padding(
                    padding: const EdgeInsets.all(20.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          context.tr('enter_phone'),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Country Code Selector + Phone Input
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                border: Border.all(color: Colors.grey.shade300),
                                borderRadius: BorderRadius.circular(12),
                                color: Colors.grey.shade50,
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: _selectedCountryCode,
                                  items: _countries.map((c) {
                                    return DropdownMenuItem<String>(
                                      value: c['code'],
                                      child: Text(
                                        '${c['flag']} ${c['code']}',
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                      ),
                                    );
                                  }).toList(),
                                  onChanged: (val) {
                                    if (val != null) setState(() => _selectedCountryCode = val);
                                  },
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: RIMWayTextField(
                                hintText: context.tr('phone_hint'),
                                controller: _phoneController,
                                keyboardType: TextInputType.phone,
                                onChanged: (_) => setState(() {}),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Terms and Conditions Checkbox
                        InkWell(
                          onTap: () {
                            setState(() {
                              _termsAccepted = !_termsAccepted;
                            });
                          },
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Checkbox(
                                value: _termsAccepted,
                                activeColor: AppTheme.primaryColor,
                                onChanged: (val) {
                                  setState(() {
                                    _termsAccepted = val ?? false;
                                  });
                                },
                              ),
                              Expanded(
                                child: Text(
                                  context.tr('terms_agreement'),
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    color: Colors.grey.shade800,
                                    height: 1.3,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),

                        if (auth.errorMessage != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 12),
                            child: Text(
                              context.tr(auth.errorMessage!),
                              style: const TextStyle(color: Colors.red, fontSize: 13),
                              textAlign: TextAlign.center,
                            ),
                          ),

                        const SizedBox(height: 20),
                        RIMWayButton(
                          text: context.tr('continue_btn'),
                          onPressed: _canContinue ? _onContinue : null,
                          isLoading: auth.isLoading,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
