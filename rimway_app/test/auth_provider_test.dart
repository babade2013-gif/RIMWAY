import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:rimway_app/features/auth/application/auth_provider.dart';
import 'package:rimway_app/features/auth/data/auth_repository.dart';
import 'package:rimway_app/core/storage/secure_storage.dart';


class MockAuthRepository extends Mock implements AuthRepository {}
class MockSecureStorage extends Mock implements SecureStorage {}

void main() {
  late MockAuthRepository mockRepo;
  late MockSecureStorage mockStorage;
  late AuthProvider authProvider;

  setUp(() {
    mockRepo = MockAuthRepository();
    mockStorage = MockSecureStorage();
    authProvider = AuthProvider(authRepository: mockRepo, secureStorage: mockStorage);
  });

  group('AuthProvider Tests', () {
    test('initial state is correct', () {
      expect(authProvider.state, AuthState.initial);
    });

    test('checkAuthStatus sets authenticated if token exists', () async {
      when(() => mockStorage.getAccessToken()).thenAnswer((_) async => 'fake_token');
      when(() => mockStorage.getUserRole()).thenAnswer((_) async => 'PASSENGER');
      await authProvider.checkAuthStatus();
      expect(authProvider.state, AuthState.authenticated);
    });

    test('checkAuthStatus sets unauthenticated if no token', () async {
      when(() => mockStorage.getAccessToken()).thenAnswer((_) async => null);
      await authProvider.checkAuthStatus();
      expect(authProvider.state, AuthState.unauthenticated);
    });

    test('sendOtp fails on invalid phone length', () async {
      final result = await authProvider.sendOtp('+222123'); // Too short
      expect(result, false);
      expect(authProvider.errorMessage, 'invalid_phone');
    });

    test('sendOtp fails on non-Mauritanian prefix', () async {
      final result = await authProvider.sendOtp('+21212345678');
      expect(result, false);
      expect(authProvider.errorMessage, 'invalid_phone');
    });

    test('sendOtp succeeds on valid phone', () async {
      when(() => mockRepo.sendOtp('+22240000000')).thenAnswer((_) async => Future.value());
      final result = await authProvider.sendOtp('+22240000000');
      expect(result, true);
      expect(authProvider.errorMessage, null);
      expect(authProvider.currentPhone, '+22240000000');
    });

    test('verifyOtp fails on invalid otp length', () async {
      // Must set phone first
      when(() => mockRepo.sendOtp('+22240000000')).thenAnswer((_) async => Future.value());
      await authProvider.sendOtp('+22240000000');
      
      final result = await authProvider.verifyOtp('123'); // Only 3 digits
      expect(result, false);
      expect(authProvider.errorMessage, 'invalid_otp');
    });

    test('verifyOtp succeeds on 4-digit otp', () async {
      when(() => mockRepo.sendOtp('+22240000000')).thenAnswer((_) async => Future.value());
      when(() => mockRepo.verifyOtp('+22240000000', '1234', role: 'PASSENGER')).thenAnswer((_) async => Future.value());
      when(() => mockStorage.getUserRole()).thenAnswer((_) async => 'PASSENGER');
      
      await authProvider.sendOtp('+22240000000');
      final result = await authProvider.verifyOtp('1234');
      
      expect(result, true);
      expect(authProvider.state, AuthState.authenticated);
    });

    test('logout clears session and state', () async {
      when(() => mockRepo.logout()).thenAnswer((_) async => Future.value());
      await authProvider.logout();
      expect(authProvider.state, AuthState.unauthenticated);
      expect(authProvider.currentPhone, null);
    });

    test('forceLogout transitions state to unauthenticated immediately', () {
      authProvider.forceLogout();
      expect(authProvider.state, AuthState.unauthenticated);
      expect(authProvider.currentPhone, null);
    });
  });
}
