export const mapConfig = {
  get googleMapsApiKey(): string {
    return import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  },
  
  get isMapConfigured(): boolean {
    return Boolean(this.googleMapsApiKey);
  },

  get isPlacesConfigured(): boolean {
    return Boolean(this.googleMapsApiKey);
  },

  get isRoutingConfigured(): boolean {
    return Boolean(this.googleMapsApiKey);
  }
};
