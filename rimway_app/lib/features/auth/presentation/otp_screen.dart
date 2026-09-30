import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/config/app_settings.dart';
import '../../../shared/widgets/rimway_button.dart';
import '../application/auth_provider.dart';

class OtpScreen extends StatefulWidget {
  final String role;
  const OtpScreen({super.key, this.role = 'PASSENGER'});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final TextEditingController _otpController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  Timer? _timer;
  int _countdown = 60;
  bool _canResend = false;

  @override
  void initState() {
    super.initState();
    _startCountdown();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  void _startCountdown() {
    _timer?.cancel();
    setState(() {
      _countdown = 60;
      _canResend = false;
    });
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdown > 1) {
        setState(() {
          _countdown--;
        });
      } else {
        timer.cancel();
        setState(() {
          _canResend = true;
        });
      }
    });
  }

  void _resendOtp() async {
    if (!_canResend) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final phone = auth.currentPhone;
    if (phone != null) {
      final sent = await auth.sendOtp(phone);
      if (sent) {
        _startCountdown();
      }
    }
  }

  void _submit() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final otp = _otpController.text.trim();
    if (otp.length != 4) return;

    final success = await auth.verifyOtp(otp, role: widget.role);
    if (success && mounted) {
      FocusScope.of(context).unfocus();
      // Remove OtpScreen from navigation stack so root Shell is visible
      Navigator.of(context).popUntil((route) => route.isFirst);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _otpController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final appSettings = Provider.of<AppSettings>(context);
    final isArabic = appSettings.currentLocale.languageCode == 'ar';
    final phone = auth.currentPhone ?? '';

    return Scaffold(
      appBar: AppBar(
        title: const Text('RIM WAY'),
        elevation: 0,
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
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              const Icon(
                Icons.lock_clock_outlined,
                size: 64,
                color: Color(0xFF1B5E20),
              ),
              const SizedBox(height: 24),
              Text(
                context.tr('enter_otp'),
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              if (phone.isNotEmpty)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '${context.tr('otp_sent_to')} ',
                      style: const TextStyle(color: Colors.grey, fontSize: 14),
                    ),
                    Text(
                      phone,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      textDirection: TextDirection.ltr,
                    ),
                  ],
                ),
              const SizedBox(height: 4),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(
                  context.tr('change_phone'),
                  style: const TextStyle(fontSize: 13),
                ),
              ),
              const SizedBox(height: 32),
              // OTP Input field
              Container(
                decoration: BoxDecoration(
                  color: Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: auth.errorMessage != null ? Colors.red : Colors.grey.shade300,
                    width: 1.5,
                  ),
                ),
                child: TextField(
                  controller: _otpController,
                  focusNode: _focusNode,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  maxLength: 4,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                  ],
                  style: const TextStyle(
                    fontSize: 32,
                    letterSpacing: 24,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: const InputDecoration(
                    counterText: '',
                    border: InputBorder.none,
                    hintText: '••••',
                    hintStyle: TextStyle(
                      color: Colors.grey,
                      letterSpacing: 24,
                      fontSize: 28,
                    ),
                  ),
                  onChanged: (val) {
                    if (val.length == 4) {
                      _submit();
                    }
                  },
                ),
              ),
              const SizedBox(height: 16),
              if (auth.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Text(
                    context.tr(auth.errorMessage!),
                    style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w500),
                    textAlign: TextAlign.center,
                  ),
                ),
              const SizedBox(height: 8),
              RIMWayButton(
                text: context.tr('verify_otp'),
                onPressed: _submit,
                isLoading: auth.isLoading,
              ),
              const SizedBox(height: 24),
              Center(
                child: _canResend
                    ? TextButton.icon(
                        icon: const Icon(Icons.refresh),
                        label: Text(
                          context.tr('resend_otp'),
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        onPressed: _resendOtp,
                      )
                    : Text(
                        '${context.tr('resend_in')} $_countdown ${context.tr('seconds')}',
                        style: const TextStyle(color: Colors.grey),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
