import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../features/captain/application/captain_provider.dart';
import '../features/captain/presentation/captain_home_screen.dart';
import '../features/captain/presentation/captain_registration_screen.dart';
import '../features/captain/presentation/captain_pending_review_screen.dart';
import '../features/captain/presentation/captain_rejected_screen.dart';
import '../features/captain/presentation/captain_suspended_screen.dart';
import '../core/theme/app_theme.dart';

class CaptainAppShell extends StatefulWidget {
  const CaptainAppShell({super.key});

  @override
  State<CaptainAppShell> createState() => _CaptainAppShellState();
}

class _CaptainAppShellState extends State<CaptainAppShell> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CaptainProvider>().fetchRegistrationStatus();
    });
  }

  @override
  Widget build(BuildContext context) {
    final captain = context.watch<CaptainProvider>();

    if (captain.registrationStatus == CaptainRegistrationStatus.unknown && captain.isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: AppTheme.primaryColor),
        ),
      );
    }

    switch (captain.registrationStatus) {
      case CaptainRegistrationStatus.approved:
        return const Scaffold(
          body: CaptainHomeScreen(),
        );
      case CaptainRegistrationStatus.pendingReview:
        return const CaptainPendingReviewScreen();
      case CaptainRegistrationStatus.rejected:
        return const CaptainRejectedScreen();
      case CaptainRegistrationStatus.suspended:
        return const CaptainSuspendedScreen();
      case CaptainRegistrationStatus.incomplete:
      case CaptainRegistrationStatus.unknown:
        return const CaptainRegistrationScreen();
    }
  }
}
