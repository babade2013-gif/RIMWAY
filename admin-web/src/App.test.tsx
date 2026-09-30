import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
/// <reference types="@testing-library/jest-dom" />
import '@testing-library/jest-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import PricingList from './pages/Pricing/PricingList';
import ComplaintsList from './pages/Complaints/ComplaintsList';
import { BrowserRouter } from 'react-router-dom';
import apiClient from './api/client';

// Mock apiClient
vi.mock('./api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  }
}));

describe('Admin Web UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should render login form', () => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      );
      expect(screen.getByText('RIM WAY Admin')).toBeTruthy();
      expect(screen.getByPlaceholderText('رقم الهاتف (مثال: +222...)')).toBeTruthy();
    });

    it('should show error on login failure', async () => {
      (apiClient.post as any).mockRejectedValueOnce({ response: { data: { message: 'Invalid phone' } } });
      
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      );
      
      const phoneInput = screen.getByPlaceholderText('رقم الهاتف (مثال: +222...)');
      fireEvent.change(phoneInput, { target: { value: '+22230000000' } });
      
      const submitBtn = screen.getByText('إرسال الرمز');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Invalid phone')).toBeTruthy();
      });
    });
  });

  describe('Phase 11 Real Screens Validation', () => {
    it('should render real Dashboard component', () => {
      render(<Dashboard />);
      expect(screen.getAllByText(/لوحة التحكم|جاري تحميل/i).length).toBeGreaterThan(0);
    });

    it('should render real Pricing component', () => {
      render(<PricingList />);
      expect(screen.getAllByText(/إدارة التسعير|جاري تحميل/i).length).toBeGreaterThan(0);
    });

    it('should render real Complaints component', () => {
      render(<ComplaintsList />);
      expect(screen.getAllByText(/إدارة الشكاوى|جاري تحميل/i).length).toBeGreaterThan(0);
    });
  });
});
