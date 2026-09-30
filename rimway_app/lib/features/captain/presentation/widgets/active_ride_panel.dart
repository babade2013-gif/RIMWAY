import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../shared/widgets/rimway_button.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../ride/domain/ride_synchronizer.dart';
import '../../../ride/data/ride_repository.dart';

class ActiveRidePanel extends StatelessWidget {
  final RideState rideState;
  final RideModel? rideModel;
  final bool isLoading;
  final VoidCallback onAction;
  final void Function(String reason) onCancel;

  const ActiveRidePanel({
    super.key,
    required this.rideState,
    required this.rideModel,
    required this.isLoading,
    required this.onAction,
    required this.onCancel,
  });

  Future<void> _makePhoneCall(BuildContext context, String rawPhone) async {
    final cleanPhone = rawPhone.replaceAll(RegExp(r'[^\d+]'), '');
    final Uri launchUri = Uri(
      scheme: 'tel',
      path: cleanPhone,
    );
    try {
      if (await canLaunchUrl(launchUri)) {
        await launchUrl(launchUri);
      } else {
        await launchUrl(launchUri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('تعذر فتح تطبيق الاتصال: $cleanPhone')),
        );
      }
    }
  }

  void _showCustomerContactSheet(BuildContext context, String passengerName, String phone) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: Colors.white,
      builder: (ctx) => Directionality(
        textDirection: TextDirection.rtl,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              const CircleAvatar(
                radius: 32,
                backgroundColor: Color(0xFFE8F5E9),
                child: Icon(Icons.phone_in_talk, color: Color(0xFF2E7D32), size: 36),
              ),
              const SizedBox(height: 12),
              Text(
                passengerName,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 6),
              const Text(
                'رقم هاتف الزبون',
                style: TextStyle(fontSize: 13, color: Colors.grey),
              ),
              const SizedBox(height: 14),
              InkWell(
                onTap: () {
                  Navigator.pop(ctx);
                  _makePhoneCall(context, phone);
                },
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F8E9),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFA5D6A7)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.call, color: Color(0xFF2E7D32), size: 24),
                      const SizedBox(width: 12),
                      Text(
                        phone,
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1B5E20),
                          letterSpacing: 1.2,
                        ),
                        textDirection: TextDirection.ltr,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'اضغط على رقم الهاتف للذهاب لتطبيق الاتصال',
                style: TextStyle(fontSize: 12, color: Colors.black54),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _makePhoneCall(context, phone);
                  },
                  icon: const Icon(Icons.phone, color: Colors.white),
                  label: const Text(
                    'اتصال عبر الهاتف',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF2E7D32),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }

  void _showCancelRideDialog(BuildContext context) {
    String selectedReason = 'الزبون لم يحضر / لم يرد على الاتصال';
    final customReasonController = TextEditingController();

    final List<String> reasons = [
      'الزبون لم يحضر / لم يرد على الاتصال',
      'عطل مفاجئ في المركبة',
      'ازدحام مروري خانق / لا يمكن الوصول',
      'طلب الزبون إلغاء المشوار',
      'سبب آخر (كتابة السبب)',
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      backgroundColor: Colors.white,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Padding(
            padding: EdgeInsets.only(
              left: 20,
              right: 20,
              top: 20,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
            ),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey[300],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'إلغاء الرحلة',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.red),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'يرجى تحديد سبب الإلغاء لإبلاغ إدارة العمليات والزبون:',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 14),
                  ...reasons.map((r) => RadioListTile<String>(
                        title: Text(r, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        value: r,
                        groupValue: selectedReason,
                        dense: true,
                        activeColor: Colors.red,
                        contentPadding: EdgeInsets.zero,
                        onChanged: (val) {
                          if (val != null) {
                            setModalState(() => selectedReason = val);
                          }
                        },
                      )),
                  const SizedBox(height: 8),
                  TextField(
                    controller: customReasonController,
                    decoration: InputDecoration(
                      hintText: 'اكتب تفاصيل إضافية أو سبباً مخصصاً...',
                      hintStyle: const TextStyle(fontSize: 12, color: Colors.black38),
                      filled: true,
                      fillColor: Colors.grey[50],
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: Colors.red),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    ),
                    maxLines: 2,
                    textDirection: TextDirection.rtl,
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: () => Navigator.pop(ctx),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('تراجع', style: TextStyle(color: Colors.black87)),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: () {
                            Navigator.pop(ctx);
                            final custom = customReasonController.text.trim();
                            final finalReason = custom.isNotEmpty ? '$selectedReason: $custom' : selectedReason;
                            onCancel(finalReason);
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red[700],
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: const Text('تأكيد الإلغاء', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final customerPhone = (rideModel?.passengerPhone ?? rideModel?.customerPhone ?? '').trim();
    final customerName = (rideModel?.passengerName ?? rideModel?.customerName ?? 'الزبون').trim();
    final pickupName = rideModel?.pickupAddress ?? 'نقطة الانطلاق';
    final dropoffName = rideModel?.dropoffAddress ?? 'وجهة الوصول';
    final fare = rideModel?.finalFare ?? rideModel?.estimatedFare ?? rideModel?.fare;
    final distanceKm = rideModel?.distanceKm;

    final canCancel = rideState.status == 'DRIVER_ASSIGNED' || rideState.status == 'DRIVER_ARRIVED';

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          boxShadow: [
            BoxShadow(
              color: Colors.black26,
              blurRadius: 10,
              spreadRadius: 1,
              offset: Offset(0, -2),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Drag Handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // 1. TOP FARE & CUSTOMER ROW (COMBINED)
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Fare & Status
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0D9488), Color(0xFF042F2E)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.payments_outlined, color: Colors.white70, size: 12),
                          const SizedBox(width: 4),
                          Text(
                            _getArabicStatus(rideState.status),
                            style: const TextStyle(color: Colors.white70, fontSize: 9, fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      Text(
                        fare != null ? '${fare.toStringAsFixed(0)} MRU' : '150 MRU',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                // Customer Info
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.grey[50],
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.grey[200]!),
                    ),
                    child: Row(
                      children: [
                        const CircleAvatar(
                          radius: 16,
                          backgroundColor: Color(0xFF0D9488),
                          child: Icon(Icons.person, color: Colors.white, size: 18),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Column(
                           crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                customerName,
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E293B)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (customerPhone.isNotEmpty)
                                Text(
                                  customerPhone,
                                  style: const TextStyle(fontSize: 10, color: Colors.black54),
                                  textDirection: TextDirection.ltr,
                                ),
                            ],
                          ),
                        ),
                        IconButton(
                          onPressed: () {
                            if (customerPhone.isNotEmpty) {
                              _showCustomerContactSheet(context, customerName, customerPhone);
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('رقم هاتف الزبون غير متوفر')),
                              );
                            }
                          },
                          icon: const Icon(Icons.call, color: Color(0xFF2E7D32)),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // 2. TRIP ROUTE DETAILS (PICKUP -> DROPOFF & DISTANCE)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.circle, color: Color(0xFF10B981), size: 10),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                pickupName,
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.location_on, color: Color(0xFFEF4444), size: 10),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                dropoffName,
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (distanceKm != null)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE0F2FE),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${distanceKm.toStringAsFixed(1)}\nكم',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0369A1)),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            if (rideState.status == 'COMPLETED' && rideModel != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: Text(
                  '${context.tr("ride_completed")}: ${rideModel!.finalFare != null ? "${rideModel!.finalFare} MRU" : context.tr("final_fare_unavailable")}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                ),
              ),

            // 3. ACTION BUTTONS ROW
            Row(
              children: [
                if (canCancel) ...[
                  Expanded(
                    flex: 2,
                    child: OutlinedButton(
                      onPressed: isLoading ? null : () => _showCancelRideDialog(context),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red[700],
                        side: const BorderSide(color: Color(0xFFFCA5A5)),
                        backgroundColor: const Color(0xFFFEF2F2),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text(
                        'إلغاء',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  flex: 5,
                  child: RIMWayButton(
                    text: _getButtonText(context),
                    onPressed: onAction,
                    isLoading: isLoading,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _getArabicStatus(String status) {
    switch (status) {
      case 'DRIVER_ASSIGNED':
        return 'في الطريق للزبون';
      case 'DRIVER_ARRIVED':
        return 'وصلت للموقع';
      case 'PASSENGER_BOARDED':
        return 'ركب الزبون';
      case 'IN_PROGRESS':
        return 'الرحلة جارية';
      case 'COMPLETED':
        return 'مكتملة';
      default:
        return status;
    }
  }

  String _getButtonText(BuildContext context) {
    switch (rideState.status) {
      case 'DRIVER_ASSIGNED':
        return 'وصلت لنقطة الانطلاق';
      case 'DRIVER_ARRIVED':
        return 'ركب الزبون';
      case 'PASSENGER_BOARDED':
        return 'بدء الرحلة';
      case 'IN_PROGRESS':
        return 'إنهاء الرحلة';
      case 'COMPLETED':
        return 'تم';
      default:
        return '...';
    }
  }
}
