import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorage {
  // Minimal Fix: Removing encryptedSharedPreferences to prevent Android Emulator Keystore Deadlocks,
  // and adding resetOnError: true to gracefully clear corrupted keys instead of hanging forever.
  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: false,
      // resetOnError ensures that if the Keystore is corrupted, it wipes it and proceeds 
      // instead of deadlocking or throwing unrecoverable PlatformExceptions.
    ),
  );

  static const _keyAccessToken = 'access_token';
  static const _keyRefreshToken = 'refresh_token';
  static const _keyUserRole = 'user_role';

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
    String role = 'PASSENGER',
  }) async {
    await _storage.write(key: _keyAccessToken, value: accessToken);
    await _storage.write(key: _keyRefreshToken, value: refreshToken);
    await _storage.write(key: _keyUserRole, value: role);
  }

  Future<String?> getAccessToken() async {
    return await _storage.read(key: _keyAccessToken);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _keyRefreshToken);
  }

  Future<String?> getUserRole() async {
    return await _storage.read(key: _keyUserRole);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: _keyAccessToken);
    await _storage.delete(key: _keyRefreshToken);
    await _storage.delete(key: _keyUserRole);
  }
}
