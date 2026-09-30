import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppSettings extends ChangeNotifier {
  static const String _languageKey = 'app_language_key';
  Locale _currentLocale = const Locale('ar'); // Default to Arabic (Primary)

  Locale get currentLocale => _currentLocale;

  Future<void> loadSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedLang = prefs.getString(_languageKey);
      if (savedLang != null) {
        _currentLocale = Locale(savedLang);
        notifyListeners();
      }
    } catch (e) {
      // Ignore initial shared prefs error on load
    }
  }

  Future<void> changeLanguage(String languageCode) async {
    if (_currentLocale.languageCode == languageCode) return;
    _currentLocale = Locale(languageCode);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_languageKey, languageCode);
    notifyListeners();
  }
}
