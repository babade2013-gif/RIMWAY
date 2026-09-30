import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/config/app_settings.dart';
import '../../../core/config/env_config.dart';
import '../../../shared/widgets/rimway_button.dart';
import '../../../shared/widgets/rimway_text_field.dart';
import '../application/captain_provider.dart';
import '../../auth/application/auth_provider.dart';
import '../../ride/data/ride_repository.dart';
import 'captain_review_summary_screen.dart';

class CaptainRegistrationScreen extends StatefulWidget {
  const CaptainRegistrationScreen({super.key});

  @override
  State<CaptainRegistrationScreen> createState() => _CaptainRegistrationScreenState();
}

class _CaptainRegistrationScreenState extends State<CaptainRegistrationScreen> {
  final _picker = ImagePicker();

  // Personal
  final TextEditingController _nameController = TextEditingController();
  String? _profilePhotoUrl;
  File? _localProfileImage;
  bool _isUploadingProfile = false;

  // Vehicle
  final TextEditingController _brandController = TextEditingController();
  final TextEditingController _modelController = TextEditingController();
  final TextEditingController _yearController = TextEditingController(text: DateTime.now().year.toString());
  final TextEditingController _colorController = TextEditingController();
  final TextEditingController _plateController = TextEditingController();
  String? _selectedServiceTypeId;

  // Documents: type -> { fileUrl, fileName, mimeType, type }
  final Map<String, Map<String, dynamic>> _documents = {};
  final Map<String, bool> _uploadingDocs = {};

  // Vehicle Photos: type -> { fileUrl, fileName, mimeType, type }
  final Map<String, Map<String, dynamic>> _vehiclePhotos = {};
  final Map<String, bool> _uploadingPhotos = {};

  int _currentStep = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final captain = Provider.of<CaptainProvider>(context, listen: false);
      captain.loadServices();

      // Pre-fill existing data if resubmitting
      if (captain.driverProfile != null) {
        final prof = captain.driverProfile!;
        if (prof['user'] != null && prof['user']['name'] != null) {
          _nameController.text = prof['user']['name'];
        }
        if (prof['user'] != null && prof['user']['photo'] != null) {
          _profilePhotoUrl = prof['user']['photo'];
        }
        if (prof['vehicle'] != null) {
          final v = prof['vehicle'];
          _brandController.text = v['brand'] ?? '';
          _modelController.text = v['model'] ?? '';
          _yearController.text = (v['year'] ?? DateTime.now().year).toString();
          _colorController.text = v['color'] ?? '';
          _plateController.text = v['plateNumber'] ?? '';
          _selectedServiceTypeId = v['serviceTypeId'];
        }
        if (prof['documents'] != null) {
          final docsList = prof['documents'] as List<dynamic>;
          for (final d in docsList) {
            final type = d['type'] as String;
            final docMap = {
              'type': type,
              'fileUrl': d['fileUrl'],
              'fileName': d['fileName'],
              'mimeType': d['mimeType'],
            };
            if (type.startsWith('VEHICLE_')) {
              _vehiclePhotos[type] = docMap;
            } else {
              _documents[type] = docMap;
            }
          }
        }
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _brandController.dispose();
    _modelController.dispose();
    _yearController.dispose();
    _colorController.dispose();
    _plateController.dispose();
    super.dispose();
  }

  String _getFullImageUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '${EnvConfig.instance.wsBaseUrl}$url';
  }

  Future<void> _pickAndUploadImage({
    required ImageSource source,
    required String category,
    required Function(Map<String, dynamic>) onSuccess,
    required Function(bool) setUploading,
    Function(String localPath)? onPickedLocal,
  }) async {
    try {
      final picked = await _picker.pickImage(source: source, imageQuality: 85);
      if (picked == null) return;

      onPickedLocal?.call(picked.path);
      setUploading(true);
      final captain = Provider.of<CaptainProvider>(context, listen: false);
      final res = await captain.uploadFile(picked.path, category: category);
      setUploading(false);

      if (res != null) {
        onSuccess(res);
      } else {
        if (mounted) {
          final err = captain.errorMessage ?? context.tr('unknown_error');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(err), backgroundColor: Colors.red),
          );
        }
      }
    } catch (e) {
      setUploading(false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('فشل في اختيار أو رفع الصورة: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showImageSourceDialog({
    required String category,
    required Function(Map<String, dynamic>) onSuccess,
    required Function(bool) setUploading,
    Function(String localPath)? onPickedLocal,
  }) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt, color: AppTheme.primaryColor),
                title: Text(context.tr('take_photo')),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _pickAndUploadImage(
                    source: ImageSource.camera,
                    category: category,
                    onSuccess: onSuccess,
                    setUploading: setUploading,
                    onPickedLocal: onPickedLocal,
                  );
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library, color: AppTheme.primaryColor),
                title: Text(context.tr('choose_gallery')),
                onTap: () {
                  Navigator.of(ctx).pop();
                  _pickAndUploadImage(
                    source: ImageSource.gallery,
                    category: category,
                    onSuccess: onSuccess,
                    setUploading: setUploading,
                    onPickedLocal: onPickedLocal,
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDocCard({
    required String typeKey,
    required String title,
    required bool isMandatory,
    required Map<String, Map<String, dynamic>> targetMap,
    required Map<String, bool> uploadingMap,
    required String category,
  }) {
    final isUploaded = targetMap.containsKey(typeKey);
    final isUploading = uploadingMap[typeKey] ?? false;

    return Card(
      margin: const EdgeInsets.symmetric(vertical: 6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isUploaded ? Colors.green.shade300 : Colors.grey.shade300,
          width: isUploaded ? 1.5 : 1.0,
        ),
      ),
      child: ListTile(
        title: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
            if (isMandatory)
              Text(
                ' *',
                style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
              ),
          ],
        ),
        subtitle: isUploaded
            ? Text(
                context.tr('document_uploaded'),
                style: const TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold),
              )
            : null,
        trailing: isUploading
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
            : ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: isUploaded ? Colors.green.shade50 : AppTheme.primaryColor.withValues(alpha: 0.1),
                  foregroundColor: isUploaded ? Colors.green.shade800 : AppTheme.primaryColor,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: Icon(isUploaded ? Icons.check : Icons.upload_file, size: 16),
                label: Text(
                  isUploaded ? context.tr('done') : context.tr('upload_document'),
                  style: const TextStyle(fontSize: 12),
                ),
                onPressed: () {
                  _showImageSourceDialog(
                    category: category,
                    setUploading: (val) => setState(() => uploadingMap[typeKey] = val),
                    onSuccess: (res) {
                      setState(() {
                        targetMap[typeKey] = {
                          'type': typeKey,
                          'fileUrl': res['fileUrl'],
                          'fileName': res['fileName'] ?? '$typeKey.jpg',
                          'mimeType': res['mimeType'] ?? 'image/jpeg',
                        };
                      });
                    },
                  );
                },
              ),
      ),
    );
  }

  List<DropdownMenuItem<String>> _buildServiceMenuItems(List<ServiceTypeModel> services) {
    if (services.isEmpty) {
      return const [
        DropdownMenuItem<String>(
          value: '8858557b-6eaf-46a9-bce8-0f2cb6d7288e',
          child: Text('Standard (عادي)', style: TextStyle(fontWeight: FontWeight.w600)),
        ),
        DropdownMenuItem<String>(
          value: 'ea705f58-5d9a-4273-841d-022033911d66',
          child: Text('Standard-RegTest', style: TextStyle(fontWeight: FontWeight.w600)),
        ),
      ];
    }
    return services.map((ServiceTypeModel s) {
      return DropdownMenuItem<String>(
        value: s.id,
        child: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w600)),
      );
    }).toList();
  }

  void _goToReview() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final phone = auth.currentPhone ?? '';

    // Ensure service type is set
    if (_selectedServiceTypeId == null) {
      final captain = Provider.of<CaptainProvider>(context, listen: false);
      _selectedServiceTypeId = captain.availableServices.isNotEmpty
          ? captain.availableServices.first.id
          : '8858557b-6eaf-46a9-bce8-0f2cb6d7288e';
    }

    // Validate inputs
    if (_nameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.tr('full_name_hint')), backgroundColor: Colors.red),
      );
      setState(() => _currentStep = 0);
      return;
    }

    if (_brandController.text.trim().isEmpty ||
        _modelController.text.trim().isEmpty ||
        _plateController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.tr('mandatory_field_missing')), backgroundColor: Colors.red),
      );
      setState(() => _currentStep = 1);
      return;
    }

    final vehicle = {
      'brand': _brandController.text.trim(),
      'model': _modelController.text.trim(),
      'year': int.tryParse(_yearController.text.trim()) ?? DateTime.now().year,
      'color': _colorController.text.trim(),
      'plateNumber': _plateController.text.trim(),
      'serviceTypeId': _selectedServiceTypeId!,
    };

    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => CaptainReviewSummaryScreen(
        name: _nameController.text.trim(),
        phone: phone,
        photoUrl: _profilePhotoUrl,
        vehicle: vehicle,
        documents: _documents,
        vehiclePhotos: _vehiclePhotos,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final captain = Provider.of<CaptainProvider>(context);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final appSettings = Provider.of<AppSettings>(context);
    final isArabic = appSettings.currentLocale.languageCode == 'ar';

    return Scaffold(
      appBar: AppBar(
        title: Text(
          context.tr('join_captains'),
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
        child: Stepper(
          type: StepperType.horizontal,
          currentStep: _currentStep,
          onStepTapped: (step) => setState(() => _currentStep = step),
          onStepContinue: () {
            if (_currentStep < 3) {
              setState(() => _currentStep++);
            } else {
              _goToReview();
            }
          },
          onStepCancel: () {
            if (_currentStep > 0) {
              setState(() => _currentStep--);
            }
          },
          controlsBuilder: (context, details) {
            final isLast = _currentStep == 3;
            return Padding(
              padding: const EdgeInsets.only(top: 24.0),
              child: Row(
                children: [
                  Expanded(
                    child: RIMWayButton(
                      text: isLast ? context.tr('review_summary') : context.tr('continue_btn'),
                      onPressed: details.onStepContinue,
                    ),
                  ),
                  if (_currentStep > 0) ...[
                    const SizedBox(width: 12),
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: details.onStepCancel,
                      child: Text(context.tr('cancel')),
                    ),
                  ],
                ],
              ),
            );
          },
          steps: [
            // Step 1: Personal Info
            Step(
              title: Text(context.tr('step_personal'), style: const TextStyle(fontSize: 12)),
              isActive: _currentStep >= 0,
              state: _nameController.text.isNotEmpty ? StepState.complete : StepState.indexed,
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Stack(
                      children: [
                        CircleAvatar(
                          radius: 46,
                          backgroundColor: Colors.grey.shade200,
                          backgroundImage: _localProfileImage != null
                              ? FileImage(_localProfileImage!) as ImageProvider
                              : (_profilePhotoUrl != null ? NetworkImage(_getFullImageUrl(_profilePhotoUrl!)) : null),
                          child: (_localProfileImage == null && _profilePhotoUrl == null)
                              ? const Icon(Icons.person, size: 48, color: Colors.grey)
                              : null,
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: InkWell(
                            onTap: () {
                              _showImageSourceDialog(
                                category: 'documents',
                                setUploading: (v) => setState(() => _isUploadingProfile = v),
                                onPickedLocal: (localPath) {
                                  setState(() => _localProfileImage = File(localPath));
                                },
                                onSuccess: (res) {
                                  setState(() => _profilePhotoUrl = res['fileUrl']);
                                },
                              );
                            },
                            child: CircleAvatar(
                              radius: 16,
                              backgroundColor: AppTheme.primaryColor,
                              child: _isUploadingProfile
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : const Icon(Icons.camera_alt, size: 16, color: Colors.white),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Text(context.tr('full_name'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  RIMWayTextField(
                    hintText: context.tr('full_name_hint'),
                    controller: _nameController,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 16),
                  Text(context.tr('phone_number'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.shade300),
                    ),
                    child: Text(
                      auth.currentPhone ?? '',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.black87),
                      textDirection: TextDirection.ltr,
                    ),
                  ),
                ],
              ),
            ),

            // Step 2: Vehicle Info
            Step(
              title: Text(context.tr('step_vehicle'), style: const TextStyle(fontSize: 12)),
              isActive: _currentStep >= 1,
              state: _brandController.text.isNotEmpty && _plateController.text.isNotEmpty
                  ? StepState.complete
                  : StepState.indexed,
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(context.tr('brand'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  RIMWayTextField(
                    hintText: context.tr('brand_hint'),
                    controller: _brandController,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  Text(context.tr('model'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  RIMWayTextField(
                    hintText: context.tr('model_hint'),
                    controller: _modelController,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(context.tr('year'), style: const TextStyle(fontWeight: FontWeight.bold)),
                            const SizedBox(height: 6),
                            RIMWayTextField(
                              hintText: '2020',
                              controller: _yearController,
                              keyboardType: TextInputType.number,
                              onChanged: (_) => setState(() {}),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(context.tr('color'), style: const TextStyle(fontWeight: FontWeight.bold)),
                            const SizedBox(height: 6),
                            RIMWayTextField(
                              hintText: context.tr('color_hint'),
                              controller: _colorController,
                              onChanged: (_) => setState(() {}),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(context.tr('plate_number'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  RIMWayTextField(
                    hintText: context.tr('plate_number_hint'),
                    controller: _plateController,
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  Text(context.tr('service_type'), style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Builder(
                    builder: (context) {
                      final serviceItems = _buildServiceMenuItems(captain.availableServices);
                      final validValues = serviceItems.map((e) => e.value).toSet();
                      final currentServiceValue = (_selectedServiceTypeId != null && validValues.contains(_selectedServiceTypeId))
                          ? _selectedServiceTypeId
                          : serviceItems.first.value;

                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(12),
                          color: Colors.white,
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            isExpanded: true,
                            hint: Text(context.tr('select_service_type')),
                            value: currentServiceValue,
                            items: serviceItems,
                            onChanged: (val) {
                              if (val != null) {
                                setState(() => _selectedServiceTypeId = val);
                              }
                            },
                          ),
                        ),
                      );
                    },
                  ),
                ],
              ),
            ),

            // Step 3: Required Documents
            Step(
              title: Text(context.tr('step_documents'), style: const TextStyle(fontSize: 12)),
              isActive: _currentStep >= 2,
              state: _documents.length >= 4 ? StepState.complete : StepState.indexed,
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildDocCard(
                    typeKey: 'NATIONAL_ID',
                    title: context.tr('national_id'),
                    isMandatory: true,
                    targetMap: _documents,
                    uploadingMap: _uploadingDocs,
                    category: 'documents',
                  ),
                  _buildDocCard(
                    typeKey: 'DRIVING_LICENSE',
                    title: context.tr('driving_license'),
                    isMandatory: true,
                    targetMap: _documents,
                    uploadingMap: _uploadingDocs,
                    category: 'documents',
                  ),
                  _buildDocCard(
                    typeKey: 'VEHICLE_INSURANCE',
                    title: context.tr('vehicle_insurance'),
                    isMandatory: true,
                    targetMap: _documents,
                    uploadingMap: _uploadingDocs,
                    category: 'documents',
                  ),
                  _buildDocCard(
                    typeKey: 'VEHICLE_REGISTRATION',
                    title: context.tr('vehicle_registration'),
                    isMandatory: true,
                    targetMap: _documents,
                    uploadingMap: _uploadingDocs,
                    category: 'documents',
                  ),
                ],
              ),
            ),

            // Step 4: 4 Vehicle Photos
            Step(
              title: Text(context.tr('step_photos'), style: const TextStyle(fontSize: 12)),
              isActive: _currentStep >= 3,
              state: _vehiclePhotos.length >= 4 ? StepState.complete : StepState.indexed,
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildDocCard(
                    typeKey: 'VEHICLE_FRONT',
                    title: context.tr('vehicle_front'),
                    isMandatory: true,
                    targetMap: _vehiclePhotos,
                    uploadingMap: _uploadingPhotos,
                    category: 'vehicles',
                  ),
                  _buildDocCard(
                    typeKey: 'VEHICLE_BACK',
                    title: context.tr('vehicle_back'),
                    isMandatory: true,
                    targetMap: _vehiclePhotos,
                    uploadingMap: _uploadingPhotos,
                    category: 'vehicles',
                  ),
                  _buildDocCard(
                    typeKey: 'VEHICLE_RIGHT',
                    title: context.tr('vehicle_right'),
                    isMandatory: true,
                    targetMap: _vehiclePhotos,
                    uploadingMap: _uploadingPhotos,
                    category: 'vehicles',
                  ),
                  _buildDocCard(
                    typeKey: 'VEHICLE_LEFT',
                    title: context.tr('vehicle_left'),
                    isMandatory: true,
                    targetMap: _vehiclePhotos,
                    uploadingMap: _uploadingPhotos,
                    category: 'vehicles',
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
