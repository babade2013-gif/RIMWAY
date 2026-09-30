import 'package:flutter/material.dart';

abstract class MapService {
  Widget buildMapContainer();
  void addMarker(String id, double lat, double lng);
  void drawRoute(List<Map<String, double>> coordinates);
  void clearMap();
}
