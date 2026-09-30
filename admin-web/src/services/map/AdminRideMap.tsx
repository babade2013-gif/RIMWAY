import { useCallback } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, useJsApiLoader } from '@react-google-maps/api';
import { mapConfig } from './mapConfig';
import type { RideLocation, RouteInfo } from './types';
import { PlacesService } from './placesService';
import LeafletRideMap from './LeafletRideMap';

const containerStyle = {
  width: '100%',
  height: '100%',
  minHeight: '400px'
};

// Default to Nouakchott
const defaultCenter = {
  lat: 18.0735,
  lng: -15.9582
};

interface AdminRideMapProps {
  pickupLocation: RideLocation | null;
  dropoffLocation: RideLocation | null;
  captainLocation: RideLocation | null;
  
  // Routes
  captainToPickupRoute?: RouteInfo | null;
  pickupToDropoffRoute?: RouteInfo | null;

  // Events
  onMapClick?: (lat: number, lng: number, placeName?: string) => void;
  onPickupDragEnd?: (lat: number, lng: number, placeName?: string) => void;
  onDropoffDragEnd?: (lat: number, lng: number, placeName?: string) => void;
  
  activePointType?: 'PICKUP' | 'DROPOFF' | null;
  fallbackToOsm?: boolean;
}

export default function AdminRideMap({
  pickupLocation,
  dropoffLocation,
  captainLocation,
  captainToPickupRoute,
  pickupToDropoffRoute,
  onMapClick,
  onPickupDragEnd,
  onDropoffDragEnd,
  activePointType,
  fallbackToOsm = false,
}: AdminRideMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places']
  });

  

  const onLoad = useCallback(function callback(_map: google.maps.Map) {}, []);

  const onUnmount = useCallback(function callback(_map: google.maps.Map) {}, []);

  const handleMapClick = async (e: google.maps.MapMouseEvent) => {
    if (!onMapClick || !e.latLng || !activePointType) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    // Attempt reverse geocode
    const place = await PlacesService.reverseGeocode(lat, lng);
    onMapClick(lat, lng, place?.name);
  };

  const handleDragEnd = async (e: google.maps.MapMouseEvent, type: 'PICKUP' | 'DROPOFF') => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    const place = await PlacesService.reverseGeocode(lat, lng);
    
    if (type === 'PICKUP' && onPickupDragEnd) {
      onPickupDragEnd(lat, lng, place?.name);
    } else if (type === 'DROPOFF' && onDropoffDragEnd) {
      onDropoffDragEnd(lat, lng, place?.name);
    }
  };

  if (!mapConfig.isMapConfigured) {
    if (fallbackToOsm) {
      return (
        <LeafletRideMap
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          captainLocation={captainLocation}
          captainToPickupRoute={captainToPickupRoute}
          pickupToDropoffRoute={pickupToDropoffRoute}
          onMapClick={onMapClick}
          onPickupDragEnd={onPickupDragEnd}
          onDropoffDragEnd={onDropoffDragEnd}
          activePointType={activePointType}
        />
      );
    }
    return (
      <div className="w-full h-96 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="font-semibold">Map Not Configured</p>
          <p className="text-sm">Google Maps API credentials are missing.</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-96 bg-gray-100 border border-gray-300 rounded-md flex items-center justify-center">
        Loading Map...
      </div>
    );
  }

  const center = pickupLocation?.lat && pickupLocation?.lng 
    ? { lat: pickupLocation.lat, lng: pickupLocation.lng } 
    : defaultCenter;

  return (
    <div className="w-full h-[500px] border border-gray-300 rounded-md overflow-hidden">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={13}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={{
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true
        }}
      >
        {pickupLocation?.lat && pickupLocation?.lng && (
          <Marker 
            position={{ lat: pickupLocation.lat, lng: pickupLocation.lng }} 
            label="P"
            title={pickupLocation.name || 'Pickup'}
            draggable={!!onPickupDragEnd}
            onDragEnd={(e) => handleDragEnd(e, 'PICKUP')}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
            }}
          />
        )}
        
        {dropoffLocation?.lat && dropoffLocation?.lng && (
          <Marker 
            position={{ lat: dropoffLocation.lat, lng: dropoffLocation.lng }} 
            label="D"
            title={dropoffLocation.name || 'Destination'}
            draggable={!!onDropoffDragEnd}
            onDragEnd={(e) => handleDragEnd(e, 'DROPOFF')}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
            }}
          />
        )}

        {captainLocation?.lat && captainLocation?.lng && (
          <Marker 
            position={{ lat: captainLocation.lat, lng: captainLocation.lng }} 
            label="C"
            title={captainLocation.name || 'Captain'}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
            }}
          />
        )}

        {pickupToDropoffRoute?.geometry && (
          <DirectionsRenderer
            directions={pickupToDropoffRoute.geometry as unknown as google.maps.DirectionsResult}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#FF0000',
                strokeWeight: 4,
                strokeOpacity: 0.7
              }
            }}
          />
        )}

        {captainToPickupRoute?.geometry && (
          <DirectionsRenderer
            directions={captainToPickupRoute.geometry as unknown as google.maps.DirectionsResult}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#0000FF',
                strokeWeight: 4,
                strokeOpacity: 0.7,
                
              }
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
