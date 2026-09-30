import 'package:flutter/material.dart';
import '../data/auth_repository.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/errors/api_exception.dart';

enum AuthState { initial, unauthenticated, authenticated }

class AuthProvider extends ChangeNotifier {
  final AuthRepository authRepository;
  final SecureStorage secureStorage;
  
  AuthState _state = AuthState.initial;
  AuthState get state => _state;

  String? _userRole;
  String? get userRole => _userRole;

  String? _currentPhone;
  String? get currentPhone => _currentPhone;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  AuthProvider({required this.authRepository, required this.secureStorage});

  Future<void> checkAuthStatus() async {
    try {
      final token = await secureStorage.getAccessToken();
      if (token != null) {
        _userRole = await secureStorage.getUserRole() ?? 'PASSENGER';
        _state = AuthState.authenticated;
      } else {
        _state = AuthState.unauthenticated;
      }
    } catch (e) {
      // Prevent indefinite splash screen hang if secure storage throws a PlatformException
      _state = AuthState.unauthenticated;
    } finally {
      notifyListeners();
    }
  }

  Future<bool> sendOtp(String phone) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Basic client-side validation
      if (phone.isEmpty || !phone.startsWith('+222') || phone.length != 12) {
        throw ApiException(message: 'invalid_phone', errorType: 'VALIDATION_ERROR');
      }

      await authRepository.sendOtp(phone);
      _currentPhone = phone;
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> verifyOtp(String otp, {String role = 'PASSENGER'}) async {
    if (_currentPhone == null) return false;
    
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      if (otp.length != 4) {
        throw ApiException(message: 'invalid_otp', errorType: 'VALIDATION_ERROR');
      }
      
      await authRepository.verifyOtp(_currentPhone!, otp, role: role);
      _userRole = await secureStorage.getUserRole() ?? role;
      _state = AuthState.authenticated;
      _isLoading = false;
      notifyListeners();
      return true;
    } on ApiException catch (e) {
      _errorMessage = e.message;
      _isLoading = false;
      notifyListeners();
      return false;
    } catch (e) {
      _errorMessage = 'An unexpected error occurred';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await authRepository.logout();
    _state = AuthState.unauthenticated;
    _currentPhone = null;
    _userRole = null;
    notifyListeners();
  }

  // Called when refresh token fails inside interceptor
  void forceLogout() {
    _state = AuthState.unauthenticated;
    _currentPhone = null;
    _userRole = null;
    notifyListeners();
  }
}



