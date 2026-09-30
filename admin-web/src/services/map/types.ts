export type RideLocation = {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  placeId?: string;
};

export type RouteInfo = {
  distanceKm?: number;
  durationMin?: number;
  geometry?: any; // Google maps DirectionsResult
};
