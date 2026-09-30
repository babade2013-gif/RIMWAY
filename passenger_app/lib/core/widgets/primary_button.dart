import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';

class PrimaryButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;

  const PrimaryButton({
    Key? key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          disabledBackgroundColor: AppColors.border,
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.md),
          elevation: 0,
        ),
        onPressed: isLoading ? null : onPressed,
        child: isLoading 
            ? const SizedBox(height: 24, width: 24, child: CircularProgressIndicator(color: AppColors.surface, strokeWidth: 2))
            : Text(text, style: const TextStyle(color: AppColors.surface, fontSize: 16, fontWeight: FontWeight.bold)),
      ),
    );
  }
}
