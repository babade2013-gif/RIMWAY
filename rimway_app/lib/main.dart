import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';
import 'core/config/env_config.dart';
import 'core/config/app_settings.dart';
import 'core/theme/app_theme.dart';
import 'core/localization/app_localizations.dart';
import 'core/storage/secure_storage.dart';
import 'core/network/api_client.dart';
import 'core/websocket/ws_client.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/application/auth_provider.dart';
import 'features/ride/data/ride_repository.dart';
import 'features/ride/domain/ride_synchronizer.dart';
import 'features/ride/application/ride_provider.dart';
import 'features/splash/splash_screen.dart';
import 'features/auth/presentation/login_screen.dart';
import 'app/app_shell.dart';
import 'app/captain_app_shell.dart';
import 'features/captain/data/captain_repository.dart';
import 'features/captain/application/captain_provider.dart';
import 'features/admin/data/admin_repository.dart';
import 'features/admin/application/admin_provider.dart';
import 'app/admin_app_shell.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Environment — Dynamic resolution for Emulator (10.0.2.2) and Physical Device (127.0.0.1 via adb reverse)
  await EnvConfig.init(Environment.development);

  // ── Core Infrastructure ──────────────────────────────────────────────────
  final appSettings = AppSettings();
  appSettings.loadSettings(); // async, non-blocking

  final secureStorage = SecureStorage();
  final apiClient = ApiClient(secureStorage: secureStorage);
  final wsClient = WsClient(secureStorage: secureStorage);

  // ── Auth ─────────────────────────────────────────────────────────────────
  final authRepo = AuthRepository(apiClient: apiClient, secureStorage: secureStorage);
  final authProvider = AuthProvider(
    authRepository: authRepo,
    secureStorage: secureStorage,
  );

  // ── Ride ─────────────────────────────────────────────────────────────────
  final rideSynchronizer = RideSynchronizer();
  final rideRepo = RideRepository(apiClient: apiClient);
  final rideProvider = RideProvider(
    rideRepository: rideRepo,
    rideSynchronizer: rideSynchronizer,
    wsClient: wsClient,
  );

  // ── Captain ──────────────────────────────────────────────────────────────
  final captainRepo = CaptainRepository(apiClient: apiClient);
  final locationService = LocationService();
  final captainProvider = CaptainProvider(
    repository: captainRepo, 
    locationService: locationService,
    wsClient: wsClient,
    rideSynchronizer: rideSynchronizer,
  );

  // ── Admin ────────────────────────────────────────────────────────────────
  final adminRepo = AdminRepository(apiClient: apiClient);
  final adminProvider = AdminProvider(repository: adminRepo);

  // Inject logout callback into auth interceptor (after all providers created)
  apiClient.setupAuthInterceptor(() {
    authProvider.forceLogout();
  });

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: appSettings),
        ChangeNotifierProvider.value(value: authProvider),
        ChangeNotifierProvider.value(value: rideProvider),
        ChangeNotifierProvider.value(value: captainProvider),
        ChangeNotifierProvider.value(value: adminProvider),
        Provider.value(value: rideSynchronizer),
        Provider.value(value: wsClient),
      ],
      child: const RimWayApp(),
    ),
  );
}

class RimWayApp extends StatelessWidget {
  const RimWayApp({super.key});

  @override
  Widget build(BuildContext context) {
    final appSettings = Provider.of<AppSettings>(context);

    return MaterialApp(
      title: 'RIM WAY',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      locale: appSettings.currentLocale,
      supportedLocales: const [
        Locale('ar'),
        Locale('fr'),
        Locale('en'),
      ],
      localizationsDelegates: const [
        AppLocalizationsDelegate(),
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          if (auth.state == AuthState.initial) {
            return const SplashScreen();
          } else if (auth.state == AuthState.authenticated) {
            if (auth.userRole == 'ADMIN' || auth.userRole == 'SUPER_ADMIN') {
              return const AdminAppShell();
            } else if (auth.userRole == 'DRIVER') {
              return const CaptainAppShell();
            } else {
              return const AppShell();
            }
          } else {
            return const LoginScreen();
          }
        },
      ),
    );
  }
}
