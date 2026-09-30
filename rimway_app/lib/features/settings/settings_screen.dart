import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/config/app_settings.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<AppSettings>(context);
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.tr('language'), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          ListTile(
            title: const Text('العربية'),
            trailing: settings.currentLocale.languageCode == 'ar' ? const Icon(Icons.check, color: Colors.green) : null,
            onTap: () => settings.changeLanguage('ar'),
          ),
          ListTile(
            title: const Text('Français'),
            trailing: settings.currentLocale.languageCode == 'fr' ? const Icon(Icons.check, color: Colors.green) : null,
            onTap: () => settings.changeLanguage('fr'),
          ),
          ListTile(
            title: const Text('English'),
            trailing: settings.currentLocale.languageCode == 'en' ? const Icon(Icons.check, color: Colors.green) : null,
            onTap: () => settings.changeLanguage('en'),
          ),
        ],
      ),
    );
  }
}
