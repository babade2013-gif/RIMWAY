import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_spacing.dart';

class PassengerHomeScreen extends StatelessWidget {
  const PassengerHomeScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // 1. MAP ABSTRACTION LAYER (Background)
          Container(color: AppColors.background, child: const Center(child: Text('MAP_PROVIDER_CONTAINER'))),
          
          // 2. SAFE AREA GREETING
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  CircleAvatar(backgroundColor: AppColors.surface, child: const Icon(Icons.person, color: AppColors.primary)),
                ],
              ),
            ),
          ),
          
          // 3. MAP-FIRST "WHERE TO?" BOTTOM CARD
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              margin: const EdgeInsets.all(AppSpacing.md),
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: AppRadius.lg,
                boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(AppLocalizations.of(context)!.homeWhereTo, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const SizedBox(height: AppSpacing.md),
                  InkWell(
                    onTap: () {
                      // Open Destination Search Sheet
                    },
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(color: AppColors.background, borderRadius: AppRadius.sm),
                      child: Row(
                        children: const [
                          Icon(Icons.search, color: AppColors.textSecondary),
                          SizedBox(width: AppSpacing.sm),
                          Text(AppLocalizations.of(context)!.homeSearchDestination, style: const TextStyle(color: AppColors.textSecondary)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
