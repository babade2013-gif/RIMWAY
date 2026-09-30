import 'dart:io';

void main() async {
  print('Testing 127.0.0.1:3000...');
  try {
    final s = await Socket.connect('127.0.0.1', 3000, timeout: const Duration(milliseconds: 300));
    print('Connected successfully to ${s.remoteAddress.address}:${s.remotePort}');
    await s.close();
  } catch (e) {
    print('Failed to connect to 127.0.0.1: $e');
  }

  print('Testing 10.0.2.2:3000...');
  try {
    final s = await Socket.connect('10.0.2.2', 3000, timeout: const Duration(milliseconds: 300));
    print('Connected successfully to ${s.remoteAddress.address}:${s.remotePort}');
    await s.close();
  } catch (e) {
    print('Failed to connect to 10.0.2.2: $e');
  }
}
