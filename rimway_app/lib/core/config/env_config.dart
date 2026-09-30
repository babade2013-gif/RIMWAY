import 'dart:io';
import 'package:flutter/foundation.dart';

enum Environment { development, staging, production }

class EnvConfig {
  final Environment environment;
  final String apiBaseUrl;
  final String wsBaseUrl;

  const EnvConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.wsBaseUrl,
  });

  static EnvConfig _instance = const EnvConfig(
    environment: Environment.development,
    apiBaseUrl: 'http://10.0.2.2:3000/api/v1',
    wsBaseUrl: 'http://10.0.2.2:3000',
  );
  static EnvConfig get instance => _instance;

  static Future<void> init(Environment env) async {
    switch (env) {
      case Environment.development:
        final host = await _resolveDevelopmentHost();
        _instance = EnvConfig(
          environment: Environment.development,
          apiBaseUrl: 'http://$host/api/v1',
          wsBaseUrl: 'http://$host',
        );
        break;
      case Environment.staging:
        _instance = const EnvConfig(
          environment: Environment.staging,
          apiBaseUrl: 'https://staging-api.rimway.mr/api/v1',
          wsBaseUrl: 'https://staging-ws.rimway.mr',
        );
        break;
      case Environment.production:
        _instance = const EnvConfig(
          environment: Environment.production,
          apiBaseUrl: 'https://api.rimway.mr/api/v1',
          wsBaseUrl: 'https://ws.rimway.mr',
        );
        break;
    }
  }

  static Future<String> _resolveDevelopmentHost() async {
    // 1. Allow explicit compile-time or runtime define override (e.g. --dart-define=API_HOST=...)
    const definedHost = String.fromEnvironment('API_HOST');
    if (definedHost.isNotEmpty) {
      return definedHost;
    }

    // 2. Android platform handling
    if (!kIsWeb && Platform.isAndroid) {
      // Priority 1: Physical Device loopback (via adb reverse tcp:3000 tcp:3000)
      try {
        final socket = await Socket.connect(
          '127.0.0.1',
          3000,
          timeout: const Duration(milliseconds: 1500),
        );
        await socket.close();
        return '127.0.0.1:3000';
      } catch (_) {}

      // Priority 2: Host LAN Wi-Fi IP (physical device on Wi-Fi without adb reverse)
      try {
        final socket = await Socket.connect(
          '10.236.98.33',
          3000,
          timeout: const Duration(milliseconds: 1500),
        );
        await socket.close();
        return '10.236.98.33:3000';
      } catch (_) {}

      // Priority 3: Android Emulator fallback (10.0.2.2 only if responding)
      try {
        final socket = await Socket.connect(
          '10.0.2.2',
          3000,
          timeout: const Duration(milliseconds: 800),
        );
        await socket.close();
        return '10.0.2.2:3000';
      } catch (_) {}

      // Default on physical device is 127.0.0.1:3000 so adb reverse works whenever run
      return '127.0.0.1:3000';
    }

    // 3. Desktop / iOS Simulator default
    return '127.0.0.1:3000';
  }
}
