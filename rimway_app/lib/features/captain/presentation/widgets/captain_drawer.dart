import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../core/config/app_settings.dart';
import '../../../../core/localization/app_localizations.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/application/auth_provider.dart';
import '../../application/captain_provider.dart';
import '../captain_wallet_screen.dart';

class CaptainDrawer extends StatelessWidget {
  const CaptainDrawer({super.key});

  void _showProfileDialog(BuildContext context, CaptainProvider captain) {
    final vehicle = captain.driverProfile?['vehicle'] as Map<String, dynamic>?;
    final brand = vehicle?['brand'] ?? '-';
    final model = vehicle?['model'] ?? '-';
    final plate = vehicle?['plateNumber'] ?? '-';
    final color = vehicle?['color'] ?? '-';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.person, color: AppTheme.primaryColor),
            const SizedBox(width: 8),
            Text(context.tr('profile'), style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              dense: true,
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.badge, size: 20),
              title: Text(captain.captainName ?? 'كابتن ريم واي', style: const TextStyle(fontWeight: FontWeight.bold)),
              subtitle: Text(captain.captainPhone ?? ''),
            ),
            const Divider(),
            const Text('بيانات المركبة المسجلة:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            Text('السيارة: $brand $model ($color)', style: const TextStyle(fontSize: 13)),
            Text('رقم اللوحة: $plate', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('حالة الحساب:', style: TextStyle(fontSize: 13)),
                Text(
                  captain.registrationStatus == CaptainRegistrationStatus.approved ? 'معتمد ومفعّل ✓' : 'قيد المراجعة',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: captain.registrationStatus == CaptainRegistrationStatus.approved ? Colors.green : Colors.orange,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('ok')),
          ),
        ],
      ),
    );
  }

  void _showStatsDialog(BuildContext context, CaptainProvider captain) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.bar_chart, color: AppTheme.primaryColor),
            const SizedBox(width: 8),
            Text(context.tr('statistics'), style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              dense: true,
              leading: const Icon(Icons.star, color: Colors.amber),
              title: const Text('تقييم الكابتن العام'),
              trailing: Text(
                '★ ${captain.rating.toStringAsFixed(1)}',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.account_balance_wallet, color: AppTheme.primaryColor),
              title: const Text('الرصيد التشغيلي الحالي'),
              trailing: Text(
                '${captain.walletBalance.toStringAsFixed(0)} MRU',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                  color: captain.isWalletExhausted ? Colors.red : Colors.green.shade700,
                ),
              ),
            ),
            ListTile(
              dense: true,
              leading: const Icon(Icons.check_circle_outline, color: Colors.green),
              title: const Text('حالة الخدمة'),
              trailing: Text(
                captain.isOnline ? 'متصل ومتاح' : 'غير متصل',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: captain.isOnline ? Colors.green : Colors.grey,
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(context.tr('ok')),
          ),
        ],
      ),
    );
  }

  void _showLanguageDialog(BuildContext context) {
    final settings = context.read<AppSettings>();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.language, color: AppTheme.primaryColor),
            const SizedBox(width: 8),
            Text(context.tr('language'), style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              title: const Text('العربية (Arabic)'),
              trailing: settings.currentLocale.languageCode == 'ar'
                  ? const Icon(Icons.check, color: AppTheme.primaryColor)
                  : null,
              onTap: () {
                settings.changeLanguage('ar');
                Navigator.pop(ctx);
              },
            ),
            ListTile(
              title: const Text('Français (French)'),
              trailing: settings.currentLocale.languageCode == 'fr'
                  ? const Icon(Icons.check, color: AppTheme.primaryColor)
                  : null,
              onTap: () {
                settings.changeLanguage('fr');
                Navigator.pop(ctx);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final captain = context.watch<CaptainProvider>();
    final auth = context.watch<AuthProvider>();

    final displayName = captain.captainName ?? (auth.currentPhone ?? 'كابتن ريم واي');
    final displayPhone = captain.captainPhone ?? (auth.currentPhone ?? '');
    final photoUrl = captain.captainPhoto;

    return Drawer(
      child: Column(
        children: [
          // Drawer Header with real captain data
          UserAccountsDrawerHeader(
            decoration: const BoxDecoration(
              color: AppTheme.primaryColor,
            ),
            accountName: Text(
              displayName,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            accountEmail: Text(
              displayPhone,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
            currentAccountPicture: CircleAvatar(
              backgroundColor: Colors.white,
              backgroundImage: (photoUrl != null && photoUrl.startsWith('http'))
                  ? NetworkImage(photoUrl)
                  : null,
              child: (photoUrl == null || !photoUrl.startsWith('http'))
                  ? const Icon(Icons.person, size: 40, color: AppTheme.primaryColor)
                  : null,
            ),
          ),

          // Rating and Quick Wallet Bar
          Container(
            color: Colors.grey.shade100,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.star, color: Colors.amber, size: 18),
                    const SizedBox(width: 4),
                    Text(
                      captain.rating.toStringAsFixed(1),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ],
                ),
                InkWell(
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const CaptainWalletScreen()),
                    );
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: captain.isWalletExhausted ? Colors.red.shade100 : Colors.green.shade100,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: captain.isWalletExhausted ? Colors.red : Colors.green.shade700,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.account_balance_wallet,
                          size: 14,
                          color: captain.isWalletExhausted ? Colors.red.shade800 : Colors.green.shade800,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '${captain.walletBalance.toStringAsFixed(0)} MRU',
                          style: TextStyle(
                            color: captain.isWalletExhausted ? Colors.red.shade900 : Colors.green.shade900,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _buildDrawerItem(
                  context,
                  icon: Icons.person,
                  title: 'profile',
                  onTap: () {
                    Navigator.pop(context);
                    _showProfileDialog(context, captain);
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.account_balance_wallet,
                  title: 'wallet',
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: captain.isWalletExhausted ? Colors.red.shade50 : Colors.green.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: captain.isWalletExhausted ? Colors.red.shade300 : Colors.green.shade300,
                      ),
                    ),
                    child: Text(
                      '${captain.walletBalance.toStringAsFixed(0)} MRU',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: captain.isWalletExhausted ? Colors.red.shade800 : Colors.green.shade800,
                      ),
                    ),
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const CaptainWalletScreen()),
                    );
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.bar_chart,
                  title: 'statistics',
                  onTap: () {
                    Navigator.pop(context);
                    _showStatsDialog(context, captain);
                  },
                ),
                _buildDrawerItem(
                  context,
                  icon: Icons.history,
                  title: 'history',
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const CaptainWalletScreen()),
                    );
                  },
                ),
                const Divider(),
                _buildDrawerItem(
                  context,
                  icon: Icons.language,
                  title: 'language',
                  trailing: Text(
                    context.read<AppSettings>().currentLocale.languageCode == 'ar' ? 'العربية' : 'Français',
                    style: const TextStyle(fontSize: 12, color: Colors.blue, fontWeight: FontWeight.bold),
                  ),
                  onTap: () => _showLanguageDialog(context),
                ),
                const Divider(),
                _buildDrawerItem(
                  context,
                  icon: Icons.logout,
                  title: 'logout',
                  textColor: Colors.red,
                  onTap: () {
                    context.read<AuthProvider>().logout();
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDrawerItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    Color? textColor,
    Widget? trailing,
    VoidCallback? onTap,
  }) {
    return ListTile(
      leading: Icon(icon, color: textColor ?? Colors.black87),
      title: Text(
        context.tr(title),
        style: TextStyle(
          color: textColor ?? Colors.black87,
          fontWeight: FontWeight.w500,
        ),
      ),
      trailing: trailing,
      onTap: onTap,
    );
  }
}
