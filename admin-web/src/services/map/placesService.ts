import { mapConfig } from './mapConfig';
import type { RideLocation } from './types';

export const NOUAKCHOTT_LANDMARKS: RideLocation[] = [
  { name: 'تفرغ زينة، شارع المختار ولد داداه', lat: 18.1030, lng: -15.9780 },
  { name: 'لكصر، قرب السوق المركزي', lat: 18.1150, lng: -15.9580 },
  { name: 'عرفات، شارع المقاومة', lat: 18.0860, lng: -15.9650 },
  { name: 'المطار الدولي القديم، نواكشوط', lat: 18.0970, lng: -15.9480 },
  { name: 'السبخة، وسط المدينة', lat: 18.0860, lng: -15.9820 },
  { name: 'دار النعيم، قرب المستشفى الوطني', lat: 18.1050, lng: -15.9320 },
  { name: 'تيارت، قرب البريد', lat: 18.1250, lng: -15.9450 },
  { name: 'ملتقى مدريد (Carrefour Madrid)', lat: 18.0770, lng: -15.9620 },
  { name: 'كرفور صباح (Carrefour Sabah)', lat: 18.1080, lng: -15.9710 },
  { name: 'جامعة نواكشوط العصرية', lat: 18.1320, lng: -15.9890 },
  { name: 'المستشفى الوطني، نواكشوط', lat: 18.0890, lng: -15.9740 },
  { name: 'سوق العاصمة (السوق الكبير)', lat: 18.0865, lng: -15.9760 },
  { name: 'الميناء، شارع كرفور باماكو', lat: 18.0580, lng: -15.9840 },
  { name: 'توجنين، شارع الأمل', lat: 18.0840, lng: -15.9180 },
  { name: 'عين الطلح، تيارت', lat: 18.1380, lng: -15.9280 },
  { name: 'شاطئ الصيادين، نواكشوط', lat: 18.1090, lng: -16.0220 },
];

export class PlacesService {
  /**
   * Search for places by query. Returns array of suggestions.
   * Supports Google Places Autocomplete + OpenStreetMap Nominatim fallback + Local Landmarks.
   */
  static async searchPlaces(query: string): Promise<RideLocation[]> {
    if (!query || query.trim().length === 0) {
      return NOUAKCHOTT_LANDMARKS.slice(0, 7);
    }

    const q = query.trim().toLowerCase();

    // 1. Search in local landmarks
    const localMatches = NOUAKCHOTT_LANDMARKS.filter(p =>
      Boolean(p.name && p.name.toLowerCase().includes(q))
    );

    // 2. Google Places Autocomplete if configured & loaded
    if (mapConfig.isPlacesConfigured && window.google?.maps?.places) {
      try {
        const autocompleteService = new window.google.maps.places.AutocompleteService();
        const response = await autocompleteService.getPlacePredictions({
          input: query,
          componentRestrictions: { country: 'mr' }
        });

        if (response?.predictions && response.predictions.length > 0) {
          const googleResults = await Promise.all(
            response.predictions.slice(0, 5).map(async (p) => {
              const details = await PlacesService.getPlaceDetails(p.place_id);
              if (details) return details;
              return {
                lat: 0,
                lng: 0,
                placeId: p.place_id,
                name: p.structured_formatting.main_text || p.description,
                address: p.description
              };
            })
          );
          const valid = googleResults.filter(r => r.lat !== 0 && r.lng !== 0);
          if (valid.length > 0) {
            return [...localMatches, ...valid];
          }
        }
      } catch (err) {
        console.warn('Google Places search failed, falling back to OSM Nominatim', err);
      }
    }

    // 3. OpenStreetMap Nominatim for Mauritania
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=mr&limit=6&accept-language=ar,fr,en`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'ar,fr,en' } });
      if (res.ok) {
        const data = await res.json();
        const osmResults: RideLocation[] = data.map((item: any) => {
          const parts = (item.display_name || '').split(',');
          const name = parts.slice(0, 2).join(', ').trim();
          return {
            name: name || item.name || query,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            address: item.display_name
          };
        });

        // Deduplicate
        const combined = [...localMatches];
        for (const item of osmResults) {
          if (!combined.some(c => Math.abs(c.lat - item.lat) < 0.001 && Math.abs(c.lng - item.lng) < 0.001)) {
            combined.push(item);
          }
        }
        return combined;
      }
    } catch (e) {
      console.warn('OSM Nominatim search error', e);
    }

    return localMatches;
  }

  /**
   * Get full location details for a placeId.
   */
  static async getPlaceDetails(placeId: string): Promise<RideLocation | null> {
    if (!mapConfig.isPlacesConfigured || !window.google?.maps?.places) {
      return null;
    }

    return new Promise((resolve) => {
      const dummyDiv = document.createElement('div');
      const placesService = new window.google.maps.places.PlacesService(dummyDiv);

      placesService.getDetails({
        placeId,
        fields: ['name', 'formatted_address', 'geometry']
      }, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          resolve({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            name: place.name || undefined,
            address: place.formatted_address || undefined,
            placeId
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Reverse geocode a lat/lng to get address details.
   */
  static async reverseGeocode(lat: number, lng: number): Promise<RideLocation | null> {
    // 1. Google Geocoder if available
    if (mapConfig.isPlacesConfigured && window.google?.maps?.Geocoder) {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response.results && response.results.length > 0) {
          const result = response.results[0];
          const nameComp = result.address_components.find(c => 
            c.types.includes('point_of_interest') || c.types.includes('route') || c.types.includes('neighborhood')
          );
          const name = nameComp ? nameComp.long_name : result.formatted_address.split(',')[0];

          return {
            lat,
            lng,
            name,
            address: result.formatted_address,
            placeId: result.place_id
          };
        }
      } catch (e) {
        console.warn('Google Reverse geocode failed, falling back to OSM Nominatim', e);
      }
    }

    // 2. OpenStreetMap Nominatim reverse geocode
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'ar,fr,en' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.display_name) {
          const parts = data.display_name.split(',');
          const name = parts.slice(0, 3).join(', ').trim();
          return {
            lat,
            lng,
            name: name || `موقع (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            address: data.display_name
          };
        }
      }
    } catch (e) {
      console.warn('OSM Reverse geocode failed', e);
    }

    return {
      lat,
      lng,
      name: `موقع (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    };
  }
}
