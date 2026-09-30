import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/config/app_settings.dart';
import '../../../core/config/env_config.dart';
import '../../../shared/widgets/rimway_button.dart';
import '../application/captain_provider.dart';
import 'captain_pending_review_screen.dart';

class CaptainReviewSummaryScreen extends StatefulWidget {
  final String name;
  final String phone;
  final String? photoUrl;
  final Map<String, dynamic> vehicle;
  final Map<String, Map<String, dynamic>> documents;
  final Map<String, Map<String, dynamic>> vehiclePhotos;

  const CaptainReviewSummaryScreen({
    super.key,
    required this.name,
    required this.phone,
    this.photoUrl,
    required this.vehicle,
    required this.documents,
    required this.vehiclePhotos,
  });

  @override
  State<CaptainReviewSummaryScreen> createState() => _CaptainReviewSummaryScreenState();
}

class _CaptainReviewSummaryScreenState extends State<CaptainReviewSummaryScreen> {
  bool _isSubmitting = false;

  bool get _isComplete {
    if (widget.name.trim().isEmpty) return false;
    if (widget.vehicle['brand'] == null || widget.vehicle['brand'].toString().isEmpty) return false;
    if (widget.vehicle['model'] == null || widget.vehicle['model'].toString().isEmpty) return false;
    if (widget.vehicle['plateNumber'] == null || widget.vehicle['plateNumber'].toString().isEmpty) return false;
    if (widget.vehicle['serviceTypeId'] == null || widget.vehicle['serviceTypeId'].toString().isEmpty) return false;

    // 4 mandatory documents
    final docTypes = ['NATIONAL_ID', 'DRIVING_LICENSE', 'VEHICLE_INSURANCE', 'VEHICLE_REGISTRATION'];
    for (final t in docTypes) {
      if (!widget.documents.containsKey(t)) return false;
    }

    // 4 vehicle photos
    final photoTypes = ['VEHICLE_FRONT', 'VEHICLE_BACK', 'VEHICLE_RIGHT', 'VEHICLE_LEFT'];
    for (final t in photoTypes) {
      if (!widget.vehiclePhotos.containsKey(t)) return false;
    }

    return true;
  }

  String _formatImageUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '${EnvConfig.instance.wsBaseUrl}$url';
  }

  void _submit() async {
    if (!_isComplete || _isSubmitting) return;

    setState(() => _isSubmitting = true);
    final captain = Provider.of<CaptainProvider>(context, listen: false);

    final payload = {
      'name': widget.name.trim(),
      if (widget.photoUrl != null) 'photo': widget.photoUrl,
      'vehicle': widget.vehicle,
      'documents': widget.documents.values.toList(),
      'vehiclePhotos': widget.vehiclePhotos.values.toList(),
    };

    final success = await captain.submitRegistration(payload);
    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const CaptainPendingReviewScreen()),
          (route) => false,
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(context.tr(captain.errorMessage ?? 'unknown_error')),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Widget _buildCheckItem(BuildContext context, String label, bool isPresent) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        children: [
          Icon(
            isPresent ? Icons.check_circle : Icons.cancel,
            color: isPresent ? Colors.green : Colors.red,
            size: 20,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 14, color: Colors.black87),
            ),
          ),
          Text(
            isPresent ? context.tr('complete') : context.tr('missing'),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: isPresent ? Colors.green : Colors.red,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final appSettings = Provider.of<AppSettings>(context);
    final isArabic = appSettings.currentLocale.languageCode == 'ar';

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: Text(
          context.tr('review_summary'),
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
        ),
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
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Personal Info Card
              Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.tr('personal_info'),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                      ),
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: Colors.grey.shade200,
                            backgroundImage: widget.photoUrl != null
                                ? NetworkImage(_formatImageUrl(widget.photoUrl!))
                                : null,
                            child: widget.photoUrl == null ? const Icon(Icons.person, size: 32, color: Colors.grey) : null,
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.name,
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  widget.phone,
                                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                                  textDirection: TextDirection.ltr,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 2. Vehicle Info Card
              Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.tr('vehicle_info'),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                      ),
                      const Divider(height: 24),
                      Text('${context.tr('brand')}: ${widget.vehicle['brand']} - ${widget.vehicle['model']} (${widget.vehicle['year']})'),
                      const SizedBox(height: 6),
                      Text('${context.tr('color')}: ${widget.vehicle['color']}'),
                      const SizedBox(height: 6),
                      Text('${context.tr('plate_number')}: ${widget.vehicle['plateNumber']}'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 3. Required Documents Card
              Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.tr('required_documents'),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                      ),
                      const Divider(height: 24),
                      _buildCheckItem(context, context.tr('national_id'), widget.documents.containsKey('NATIONAL_ID')),
                      _buildCheckItem(context, context.tr('driving_license'), widget.documents.containsKey('DRIVING_LICENSE')),
                      _buildCheckItem(context, context.tr('vehicle_insurance'), widget.documents.containsKey('VEHICLE_INSURANCE')),
                      _buildCheckItem(context, context.tr('vehicle_registration'), widget.documents.containsKey('VEHICLE_REGISTRATION')),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // 4. Vehicle Photos Card
              Card(
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.tr('vehicle_photos'),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.primaryColor),
                      ),
                      const Divider(height: 24),
                      _buildCheckItem(context, context.tr('vehicle_front'), widget.vehiclePhotos.containsKey('VEHICLE_FRONT')),
                      _buildCheckItem(context, context.tr('vehicle_back'), widget.vehiclePhotos.containsKey('VEHICLE_BACK')),
                      _buildCheckItem(context, context.tr('vehicle_right'), widget.vehiclePhotos.containsKey('VEHICLE_RIGHT')),
                      _buildCheckItem(context, context.tr('vehicle_left'), widget.vehiclePhotos.containsKey('VEHICLE_LEFT')),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              if (!_isComplete)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Text(
                    context.tr('mandatory_field_missing'),
                    style: const TextStyle(color: Colors.red, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ),

              RIMWayButton(
                text: context.tr('submit_application'),
                onPressed: _isComplete ? _submit : null,
                isLoading: _isSubmitting,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
