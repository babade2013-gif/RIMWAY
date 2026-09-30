import 'package:go_router/go_router.dart';

class AppRouter {
  static GoRouter createRouter(bool isAuthenticated, String role) {
    return GoRouter(
      initialLocation: '/passenger/home',
      redirect: (context, state) {
        final isGoingToLogin = state.uri.toString() == '/login';
        
        // Unauthenticated User
        if (!isAuthenticated && !isGoingToLogin) return '/login';
        
        // Authenticated User logic
        if (isAuthenticated && isGoingToLogin) {
          return role == 'DRIVER' ? '/driver/home' : '/passenger/home';
        }
        
        // Role Protection Guards
        if (isAuthenticated && state.uri.toString().startsWith('/driver') && role != 'DRIVER') {
          return '/passenger/home';
        }
        if (isAuthenticated && state.uri.toString().startsWith('/passenger') && role != 'PASSENGER') {
          return '/driver/home';
        }
        
        return null; // No redirect needed
      },
      routes: [
        // ShellRoute setup goes here
      ],
    );
  }
}
