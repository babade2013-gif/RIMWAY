import { mapConfig } from './mapConfig';
import type { RideLocation, RouteInfo } from './types';

export class RoutingService {
  /**
   * Get route between origin and destination.
   * Uses real Google Maps Directions API if configured, otherwise uses OSRM or Haversine road estimation.
   */
  static async getRoute(origin: RideLocation, destination: RideLocation): Promise<RouteInfo | null> {
    if (!mapConfig.isRoutingConfigured) {
      return null;
    }

    if (!origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return null;
    }

    // 1. Google Maps Directions
    if (mapConfig.isRoutingConfigured && window.google?.maps?.DirectionsService) {
      try {
        const directionsService = new window.google.maps.DirectionsService();
        const response = await directionsService.route({
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: window.google.maps.TravelMode.DRIVING
        });

        if (response.routes && response.routes.length > 0) {
          const route = response.routes[0];
          const leg = route.legs[0];
          
          return {
            distanceKm: leg.distance ? Math.round((leg.distance.value / 1000) * 10) / 10 : 0,
            durationMin: leg.duration ? Math.round(leg.duration.value / 60) : 0,
            geometry: response
          };
        }
      } catch (e) {
        console.warn('Google Directions request failed, trying OSRM:', e);
      }
    }

    // 2. Open Source Routing Machine (OSRM)
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distanceKm = Math.max(0.5, Math.round((route.distance / 1000) * 10) / 10);
          const durationMin = Math.max(2, Math.round(route.duration / 60));
          // GeoJSON is [lng, lat], Leaflet polyline expects [lat, lng]
          const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          return {
            distanceKm,
            durationMin,
            geometry: coords
          };
        }
      }
    } catch (e) {
      console.warn('OSRM routing request failed, falling back to Haversine:', e);
    }

    // 3. Fallback: Haversine with road curvature factor (1.25x)
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(destination.lat - origin.lat);
    const dLng = toRad(destination.lng - origin.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) * Math.sin(dLng / 2) ** 2;
    const straightDist = 6371 * 2 * Math.asin(Math.sqrt(a));
    const roadDist = Math.max(0.8, Math.round(straightDist * 1.25 * 10) / 10);
    const dur = Math.max(2, Math.round(roadDist * 2.5));

    return {
      distanceKm: roadDist,
      durationMin: dur,
      geometry: [
        [origin.lat, origin.lng],
        [destination.lat, destination.lng]
      ]
    };
  }
}
