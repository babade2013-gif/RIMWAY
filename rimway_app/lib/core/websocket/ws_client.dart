import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../storage/secure_storage.dart';
import '../config/env_config.dart';

class WsClient {
  final SecureStorage secureStorage;
  IO.Socket? _socket;

  // Stream controller to broadcast parsed ride events internally
  final _rideEventController = StreamController<Map<String, dynamic>>.broadcast();
  Stream<Map<String, dynamic>> get rideEvents => _rideEventController.stream;

  WsClient({required this.secureStorage});

  bool _isConnecting = false;

  Future<void> connect() async {
    if (_isConnecting) return;
    
    final token = await secureStorage.getAccessToken();
    if (token == null) return;

    if (_socket != null && _socket!.connected) return;

    _isConnecting = true;

    // Disconnect old socket if it exists but is not connected
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
    }

    _socket = IO.io(EnvConfig.instance.wsBaseUrl, IO.OptionBuilder()
        .setTransports(['websocket'])
        .disableAutoConnect()
        .setAuth({'token': token})
        .build());

    _socket!.onConnect((_) {
      print('WebSocket connected');
      _isConnecting = false;
    });

    _socket!.onDisconnect((_) {
      print('WebSocket disconnected');
      _isConnecting = false;
    });

    _socket!.onConnectError((_) {
      print('WebSocket connection error');
      _isConnecting = false;
    });

    // Exact event names from WEBSOCKET_CONTRACT.md
    _socket!.on('ride_status_changed', (data) {
      if (data is Map<String, dynamic>) {
        _rideEventController.add(data);
      }
    });

    _socket!.on('ride_requested', (data) {
      if (data is Map<String, dynamic>) {
        // Driver specific event handling
        _rideEventController.add({...data, 'event_type': 'ride_requested'});
      }
    });

    _socket!.connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _isConnecting = false;
  }
}
