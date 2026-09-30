/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CreatePhoneRide from '../src/pages/Rides/CreatePhoneRide';
import { mapConfig } from '../src/services/map/mapConfig';
import { PlacesService } from '../src/services/map/placesService';
import { RoutingService } from '../src/services/map/routingService';
import apiClient from '../src/api/client';

// Mock dependencies
vi.mock('../src/api/client', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [{ id: 'st-1', name: 'Economy' }] })),
    post: vi.fn(() => Promise.resolve({ data: { id: 'ride-1' } }))
  }
}));

describe('Admin Web Maps Integration Foundation', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
    window.alert = vi.fn();
  });

  describe('Configuration State', () => {
    it('should reflect missing credentials state safely', () => {
      // Assuming no env var is set in test mode
      expect(mapConfig.isMapConfigured).toBe(false);
      expect(mapConfig.isPlacesConfigured).toBe(false);
      expect(mapConfig.isRoutingConfigured).toBe(false);
    });
  });

  describe('Places Service Interface', () => {
    it('should return empty array when searchPlaces is called without config', async () => {
      const results = await PlacesService.searchPlaces('Hotel');
      expect(results).toEqual([]);
    });

    it('should return null when getPlaceDetails is called without config', async () => {
      const details = await PlacesService.getPlaceDetails('place_id_123');
      expect(details).toBeNull();
    });
  });

  describe('Routing Service Interface', () => {
    it('should return null when getRoute is called without config', async () => {
      const origin = { lat: 10, lng: 10 };
      const dest = { lat: 20, lng: 20 };
      const route = await RoutingService.getRoute(origin, dest);
      expect(route).toBeNull();
    });
  });

  describe('CreatePhoneRide Map Integration', () => {
    it('renders Map Not Configured state', async () => {
      render(
        <MemoryRouter>
          <CreatePhoneRide />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Map Not Configured')).toBeTruthy();
      expect(screen.getByText('Google Maps API credentials are missing.')).toBeTruthy();
    });

    it('No frontend fare calculation - shows Backend fallback text', async () => {
      render(
        <MemoryRouter>
          <CreatePhoneRide />
        </MemoryRouter>
      );
      
      expect(screen.getByText('يحسب في الـ Backend')).toBeTruthy();
      expect(screen.getByText('يحسب في الـ Backend عند الإرسال')).toBeTruthy();
    });

    it('CreatePhoneRide payload mapping and Idempotency header remains unchanged', async () => {
      render(
        <MemoryRouter>
          <CreatePhoneRide />
        </MemoryRouter>
      );

      // Wait for service types to load
      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith('/pricing/service-types');
      });

      // Fill form (using the fallback coordinate inputs since Map is not configured)
      const textboxes = screen.getAllByRole('textbox');
      // The first textbox is Customer Name, second is Phone
      fireEvent.change(textboxes[0], { target: { value: 'John Doe' } });
      fireEvent.change(textboxes[1], { target: { value: '+2221234567' } });
      
      const latInputs = screen.getAllByPlaceholderText('Lat');
      const lngInputs = screen.getAllByPlaceholderText('Lng');
      
      fireEvent.change(latInputs[0], { target: { value: '18.1' } });
      fireEvent.change(lngInputs[0], { target: { value: '-15.9' } });
      fireEvent.change(latInputs[1], { target: { value: '18.2' } });
      fireEvent.change(lngInputs[1], { target: { value: '-15.8' } });

      // Search inputs update the name
      const searchInputs = textboxes.filter(el => 
        el.getAttribute('placeholder')?.includes('ابحث')
      );
      
      fireEvent.change(searchInputs[0], { target: { value: 'Pickup Point' } });
      fireEvent.change(searchInputs[1], { target: { value: 'Dropoff Point' } });

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'st-1' } });

      const submitButton = screen.getByRole('button', { name: /تأكيد وإنشاء الرحلة/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(apiClient.post).toHaveBeenCalled();
      });

      const postCall = vi.mocked(apiClient.post).mock.calls[0];
      expect(postCall[0]).toBe('/admin/rides');
      
      const payload = postCall[1];
      expect(payload).toMatchObject({
        customerName: 'John Doe',
        customerPhone: '+2221234567',
        pickupName: 'Pickup Point',
        dropoffName: 'Dropoff Point',
        pickupLat: 18.1,
        pickupLng: -15.9,
        dropoffLat: 18.2,
        dropoffLng: -15.8,
        serviceTypeId: 'st-1'
      });

      const config = postCall[2];
      expect(config?.headers).toHaveProperty('Idempotency-Key');
      // Assert it's a valid UUID
      expect(config?.headers?.['Idempotency-Key']).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });
});
