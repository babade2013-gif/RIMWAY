import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../storage/secure_storage.dart';

class WebSocketClient {
  IO.Socket? _socket;
  final SecureStorage secureStorage;
  final Function() onReconnect;

  WebSocketClient(this.secureStorage, {required this.onReconnect});

  Future<void> connect() async {
    final token = await secureStorage.readAccessToken();
    _socket = IO.io(const String.fromEnvironment('WS_URL', defaultValue: 'http://10.0.2.2:3000'), <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
      'auth': {'token': token}
    });

    _socket?.onConnect((_) {
      print('WebSocket Connected');
      onReconnect(); // Fetch last known state from REST API to prevent event loss
    });

    _socket?.onDisconnect((_) => print('WebSocket Disconnected'));
    
    // Exponential backoff is handled natively by socket.io-client via reconnection options
    _socket?.connect();
  }

  void onRideEvent(Function(dynamic) callback) {
    _socket?.on('ride_status_changed', (data) => callback(data));
  }
}
