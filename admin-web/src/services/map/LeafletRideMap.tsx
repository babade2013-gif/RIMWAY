import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RideLocation, RouteInfo } from './types';

interface LeafletRideMapProps {
  pickupLocation: RideLocation | null;
  dropoffLocation: RideLocation | null;
  captainLocation: RideLocation | null;
  captainToPickupRoute?: RouteInfo | null;
  pickupToDropoffRoute?: RouteInfo | null;
  onMapClick?: (lat: number, lng: number, placeName?: string) => void;
  onPickupDragEnd?: (lat: number, lng: number, placeName?: string) => void;
  onDropoffDragEnd?: (lat: number, lng: number, placeName?: string) => void;
  activePointType?: 'PICKUP' | 'DROPOFF' | null;
}

const defaultCenter: [number, number] = [18.0735, -15.9582]; // Nouakchott

// Create custom pin icon
const createPinIcon = (letter: string, color: string) => {
  return L.divIcon({
    className: 'custom-osm-pin',
    html: `
      <div style="
        position: relative;
        width: 34px;
        height: 34px;
        background: ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 2px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-weight: 800;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 13px;
        ">${letter}</span>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
};

export default function LeafletRideMap({
  pickupLocation,
  dropoffLocation,
  captainLocation,
  pickupToDropoffRoute,
  onMapClick,
  onPickupDragEnd,
  onDropoffDragEnd,
  activePointType
}: LeafletRideMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const polylineRef = useRef<L.Polyline | null>(null);

  // Keep latest callbacks in refs to avoid recreating the map
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const onPickupDragEndRef = useRef(onPickupDragEnd);
  onPickupDragEndRef.current = onPickupDragEnd;

  const onDropoffDragEndRef = useRef(onDropoffDragEnd);
  onDropoffDragEndRef.current = onDropoffDragEnd;

  const activePointTypeRef = useRef(activePointType);
  activePointTypeRef.current = activePointType;

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        let placeName = `نقطة مختارة (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

        // Reverse geocoding attempt
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
            headers: { 'Accept-Language': 'ar,fr,en' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.display_name) {
              const parts = data.display_name.split(',');
              placeName = parts.slice(0, 3).join(',').trim();
            }
          }
        } catch {
          // Fallback to coordinates
        }

        if (onMapClickRef.current) {
          onMapClickRef.current(lat, lng, placeName);
        }
      });

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers and Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 1. Pickup Marker
    if (pickupLocation?.lat && pickupLocation?.lng) {
      if (markersRef.current.pickup) {
        markersRef.current.pickup.setLatLng([pickupLocation.lat, pickupLocation.lng]);
      } else {
        const marker = L.marker([pickupLocation.lat, pickupLocation.lng], {
          icon: createPinIcon('P', '#10b981'),
          draggable: !!onPickupDragEndRef.current,
        }).addTo(map);

        marker.on('dragend', (e) => {
          const { lat, lng } = e.target.getLatLng();
          onPickupDragEndRef.current?.(lat, lng, `نقطة انطلاق (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        });

        markersRef.current.pickup = marker;
      }
      markersRef.current.pickup.bindPopup(`<b>نقطة الانطلاق (Pickup)</b><br/>${pickupLocation.name || ''}`);
    } else if (markersRef.current.pickup) {
      map.removeLayer(markersRef.current.pickup);
      delete markersRef.current.pickup;
    }

    // 2. Dropoff Marker
    if (dropoffLocation?.lat && dropoffLocation?.lng) {
      if (markersRef.current.dropoff) {
        markersRef.current.dropoff.setLatLng([dropoffLocation.lat, dropoffLocation.lng]);
      } else {
        const marker = L.marker([dropoffLocation.lat, dropoffLocation.lng], {
          icon: createPinIcon('D', '#ef4444'),
          draggable: !!onDropoffDragEndRef.current,
        }).addTo(map);

        marker.on('dragend', (e) => {
          const { lat, lng } = e.target.getLatLng();
          onDropoffDragEndRef.current?.(lat, lng, `نقطة وصول (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        });

        markersRef.current.dropoff = marker;
      }
      markersRef.current.dropoff.bindPopup(`<b>وجهة الوصول (Destination)</b><br/>${dropoffLocation.name || ''}`);
    } else if (markersRef.current.dropoff) {
      map.removeLayer(markersRef.current.dropoff);
      delete markersRef.current.dropoff;
    }

    // 3. Captain Marker
    if (captainLocation?.lat && captainLocation?.lng) {
      if (markersRef.current.captain) {
        markersRef.current.captain.setLatLng([captainLocation.lat, captainLocation.lng]);
      } else {
        const marker = L.marker([captainLocation.lat, captainLocation.lng], {
          icon: createPinIcon('C', '#3b82f6'),
        }).addTo(map);

        markersRef.current.captain = marker;
      }
      markersRef.current.captain.bindPopup(`<b>الكابتن (Captain)</b><br/>${captainLocation.name || ''}`);
    } else if (markersRef.current.captain) {
      map.removeLayer(markersRef.current.captain);
      delete markersRef.current.captain;
    }

    // 4. Route Polyline
    if (pickupLocation?.lat && pickupLocation?.lng && dropoffLocation?.lat && dropoffLocation?.lng) {
      let latlngs: [number, number][] = [
        [pickupLocation.lat, pickupLocation.lng],
        [dropoffLocation.lat, dropoffLocation.lng],
      ];

      if (pickupToDropoffRoute?.geometry && Array.isArray(pickupToDropoffRoute.geometry) && pickupToDropoffRoute.geometry.length > 0) {
        latlngs = pickupToDropoffRoute.geometry as [number, number][];
      }

      if (polylineRef.current) {
        polylineRef.current.setLatLngs(latlngs);
      } else {
        polylineRef.current = L.polyline(latlngs, {
          color: '#2563eb',
          weight: 5,
          opacity: 0.9,
        }).addTo(map);
      }

      // Auto-fit bounds to show both points nicely
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else {
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }
      if (pickupLocation?.lat && pickupLocation?.lng) {
        map.panTo([pickupLocation.lat, pickupLocation.lng]);
      }
    }
  }, [pickupLocation, dropoffLocation, captainLocation, pickupToDropoffRoute]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '450px',
        zIndex: 1,
      }}
    />
  );
}
