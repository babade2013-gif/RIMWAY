import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../application/ride_provider.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/widgets/rimway_button.dart';

class RideStatusScreen extends StatelessWidget {
  const RideStatusScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<RideProvider>(
      builder: (context, ride, _) {
        return _RideStatusContent(ride: ride);
      },
    );
  }
}

class _RideStatusContent extends StatelessWidget {
  final RideProvider ride;
  const _RideStatusContent({required this.ride});

  @override
  Widget build(BuildContext context) {
    final tr = context.tr;

    return Scaffold(
      backgroundColor: AppTheme.backgroundColor,
      body: SafeArea(
        child: switch (ride.flowState) {
          RideFlowState.searching => _SearchingView(
              onCancel: () => ride.cancelRide(),
              tr: tr,
            ),
          RideFlowState.driverAssigned => _StatusCardView(
              icon: Icons.directions_car,
              iconColor: AppTheme.primaryColor,
              title: tr('driver_assigned'),
              subtitle: tr('driver_on_the_way'),
              showCancel: true,
              onCancel: () => _confirmCancel(context, ride, tr),
              tr: tr,
            ),
          RideFlowState.driverArrived => _StatusCardView(
              icon: Icons.location_on,
              iconColor: AppTheme.accentColor,
              title: tr('driver_arrived'),
              subtitle: tr('please_meet_driver'),
              showCancel: true,
              onCancel: () => _confirmCancel(context, ride, tr),
              tr: tr,
            ),
          RideFlowState.inProgress => _StatusCardView(
              icon: Icons.navigation,
              iconColor: AppTheme.primaryColor,
              title: tr('in_progress'),
              subtitle: tr('heading_to_destination'),
              showCancel: false,
              tr: tr,
            ),
          RideFlowState.completed => _CompletedView(
              ride: ride,
              tr: tr,
            ),
          RideFlowState.noDriverFound => _NoDriverView(
              onRetry: () => ride.resetToIdle(),
              tr: tr,
            ),
          RideFlowState.cancelled => _CancelledView(
              onDismiss: () => ride.resetToIdle(),
              tr: tr,
            ),
          RideFlowState.error => _ErrorView(
              message: ride.errorMessage,
              onDismiss: () => ride.resetToIdle(),
              tr: tr,
            ),
          _ => const SizedBox.shrink(),
        },
      ),
    );
  }
}

// â”€â”€â”€ Searching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _SearchingView extends StatefulWidget {
  final VoidCallback onCancel;
  final String Function(String) tr;
  const _SearchingView({required this.onCancel, required this.tr});

  @override
  State<_SearchingView> createState() => _SearchingViewState();
}

class _SearchingViewState extends State<_SearchingView>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..repeat(reverse: true);
    _pulse = Tween<double>(begin: 0.9, end: 1.1).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            ScaleTransition(
              scale: _pulse,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppTheme.primaryColor.withValues(alpha: 0.15),
                ),
                child: const Icon(
                  Icons.search,
                  size: 60,
                  color: AppTheme.primaryColor,
                ),
              ),
            ),
            const SizedBox(height: 32),
            Text(
              widget.tr('finding_driver'),
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
                color: AppTheme.primaryColor,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              widget.tr('searching_subtitle'),
              style: TextStyle(fontSize: 14, color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 48),
            OutlinedButton.icon(
              onPressed: widget.onCancel,
              icon: const Icon(Icons.close, color: Colors.red),
              label: Text(
                widget.tr('cancel'),
                style: const TextStyle(color: Colors.red),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Colors.red),
                padding:
                    const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// â”€â”€â”€ Generic Status Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _StatusCardView extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final bool showCancel;
  final VoidCallback? onCancel;
  final String Function(String) tr;

  const _StatusCardView({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.showCancel,
    required this.tr,
    this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Card(
          elevation: 8,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: iconColor.withValues(alpha: 0.1),
                  ),
                  child: Icon(icon, size: 52, color: iconColor),
                ),
                const SizedBox(height: 24),
                Text(
                  title,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                  textAlign: TextAlign.center,
                ),
                if (showCancel && onCancel != null) ...[
                  const SizedBox(height: 28),
                  OutlinedButton.icon(
                    onPressed: onCancel,
                    icon: const Icon(Icons.close, color: Colors.red),
                    label: Text(tr('cancel'),
                        style: const TextStyle(color: Colors.red)),
                    style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Colors.red)),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

void _confirmCancel(
    BuildContext context, RideProvider ride, String Function(String) tr) {
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(tr('cancel_ride_confirm')),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: Text(tr('no_keep')),
        ),
        TextButton(
          onPressed: () {
            Navigator.of(ctx).pop();
            ride.cancelRide();
          },
          child: Text(tr('yes_cancel'),
              style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
        ),
      ],
    ),
  );
}

// ─── Completed with Rating ──────────────────────────────────────────────────
class _CompletedView extends StatefulWidget {
  final RideProvider ride;
  final String Function(String) tr;
  const _CompletedView({required this.ride, required this.tr});

  @override
  State<_CompletedView> createState() => _CompletedViewState();
}

class _CompletedViewState extends State<_CompletedView> {
  int _selectedRating = 5;
  final TextEditingController _commentController = TextEditingController();
  bool _isSubmitting = false;
  bool _ratingSubmitted = false;

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  void _submitRating() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);

    final comment = _commentController.text.trim();
    final success = await widget.ride.rateRide(
      rating: _selectedRating,
      comment: comment.isNotEmpty ? comment : null,
    );

    if (mounted) {
      setState(() {
        _isSubmitting = false;
        if (success) _ratingSubmitted = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final tr = widget.tr;
    final activeRide = widget.ride.activeRide;
    final fare = activeRide?.finalFare ??
        activeRide?.fare ??
        widget.ride.estimate?.estimatedFare;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Card(
          elevation: 8,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.check_circle,
                    size: 72, color: AppTheme.primaryColor),
                const SizedBox(height: 16),
                Text(
                  tr('ride_completed'),
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                ),
                if (fare != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${fare.toStringAsFixed(0)} ${tr('mru')}',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: AppTheme.primaryColor,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                const Divider(),
                const SizedBox(height: 12),
                if (!_ratingSubmitted) ...[
                  Text(
                    tr('rate_ride_prompt'),
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(5, (index) {
                      final starNum = index + 1;
                      return IconButton(
                        iconSize: 36,
                        icon: Icon(
                          starNum <= _selectedRating
                              ? Icons.star
                              : Icons.star_border,
                          color: Colors.amber,
                        ),
                        onPressed: () {
                          setState(() => _selectedRating = starNum);
                        },
                      );
                    }),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _commentController,
                    decoration: InputDecoration(
                      hintText: tr('optional_comment'),
                      hintStyle: const TextStyle(fontSize: 14),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                    ),
                    maxLines: 2,
                  ),
                  const SizedBox(height: 16),
                  RIMWayButton(
                    text: tr('submit_rating'),
                    onPressed: _submitRating,
                    isLoading: _isSubmitting,
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () => widget.ride.resetToIdle(),
                    child: Text(
                      tr('done'),
                      style: const TextStyle(color: Colors.grey, fontSize: 15),
                    ),
                  ),
                ] else ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.thumb_up, color: AppTheme.primaryColor, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        tr('rating_submitted'),
                        style: const TextStyle(
                          color: AppTheme.primaryColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  RIMWayButton(
                    text: tr('done'),
                    onPressed: () => widget.ride.resetToIdle(),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// â”€â”€â”€ No Driver Found â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _NoDriverView extends StatelessWidget {
  final VoidCallback onRetry;
  final String Function(String) tr;
  const _NoDriverView({required this.onRetry, required this.tr});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.car_crash, size: 80, color: Colors.orange),
            const SizedBox(height: 24),
            Text(
              tr('no_driver_found'),
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            RIMWayButton(text: tr('try_again'), onPressed: onRetry),
          ],
        ),
      ),
    );
  }
}

// â”€â”€â”€ Cancelled â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _CancelledView extends StatelessWidget {
  final VoidCallback onDismiss;
  final String Function(String) tr;
  const _CancelledView({required this.onDismiss, required this.tr});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cancel_outlined, size: 80, color: Colors.red),
            const SizedBox(height: 24),
            Text(
              tr('ride_cancelled'),
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            RIMWayButton(text: tr('ok'), onPressed: onDismiss),
          ],
        ),
      ),
    );
  }
}

// â”€â”€â”€ Error â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
class _ErrorView extends StatelessWidget {
  final String? message;
  final VoidCallback onDismiss;
  final String Function(String) tr;
  const _ErrorView(
      {required this.message,
      required this.onDismiss,
      required this.tr});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline,
                size: 80, color: AppTheme.errorColor),
            const SizedBox(height: 24),
            Text(
              message ?? tr('unknown_error'),
              style: const TextStyle(fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            RIMWayButton(text: tr('ok'), onPressed: onDismiss),
          ],
        ),
      ),
    );
  }
}

