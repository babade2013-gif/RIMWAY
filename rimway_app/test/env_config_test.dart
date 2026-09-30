import 'package:flutter_test/flutter_test.dart';
import 'package:rimway_app/core/config/env_config.dart';

void main() {
  group('EnvConfig Network Resolution Tests', () {
    test('Development environment initializes and sets matching REST and WS URLs', () async {
      await EnvConfig.init(Environment.development);

      expect(EnvConfig.instance.environment, Environment.development);
      expect(EnvConfig.instance.apiBaseUrl, startsWith('http://'));
      expect(EnvConfig.instance.apiBaseUrl, endsWith('/api/v1'));
      expect(EnvConfig.instance.wsBaseUrl, startsWith('http://'));

      // REST and WebSocket must share the exact same host & port strategy
      final restHost = Uri.parse(EnvConfig.instance.apiBaseUrl).host;
      final restPort = Uri.parse(EnvConfig.instance.apiBaseUrl).port;
      final wsHost = Uri.parse(EnvConfig.instance.wsBaseUrl).host;
      final wsPort = Uri.parse(EnvConfig.instance.wsBaseUrl).port;

      expect(restHost, wsHost);
      expect(restPort, wsPort);
    });

    test('Staging and Production environments preserve official URLs', () async {
      await EnvConfig.init(Environment.staging);
      expect(EnvConfig.instance.apiBaseUrl, 'https://staging-api.rimway.mr/api/v1');
      expect(EnvConfig.instance.wsBaseUrl, 'https://staging-ws.rimway.mr');

      await EnvConfig.init(Environment.production);
      expect(EnvConfig.instance.apiBaseUrl, 'https://api.rimway.mr/api/v1');
      expect(EnvConfig.instance.wsBaseUrl, 'https://ws.rimway.mr');
    });
  });
}
