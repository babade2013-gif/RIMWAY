
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import AdminLayout from './components/layout/AdminLayout';
import CaptainsList from './pages/Captains/CaptainsList';
import CaptainDetails from './pages/Captains/CaptainDetails';
import CreateCaptain from './pages/Captains/CreateCaptain';
import RidesList from './pages/Rides/RidesList';
import CreatePhoneRide from './pages/Rides/CreatePhoneRide';
import Pricing from './pages/Pricing/PricingList';
import Complaints from './pages/Complaints/ComplaintsList';
import ActivityLog from './pages/Activity/ActivityLog';
import Dashboard from './pages/Dashboard/Dashboard';
import RideDetails from './pages/Rides/RideDetails';
import WalletsManagement from './pages/Wallets/WalletsManagement';
import GoogleApiTest from './pages/GoogleApiTest';

import SystemSettings from './pages/Settings/SystemSettings';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((state) => state.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="rides" element={<RidesList />} />
          <Route path="rides/create" element={<CreatePhoneRide />} />
          <Route path="rides/:id" element={<RideDetails />} />
          <Route path="captains" element={<CaptainsList />} />
          <Route path="captains/create" element={<CreateCaptain />} />
          <Route path="captains/:id" element={<CaptainDetails />} />
          <Route path="wallets" element={<WalletsManagement />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="complaints" element={<Complaints />} />
          <Route path="activity" element={<ActivityLog />} />
          <Route path="settings" element={<SystemSettings />} />
        </Route>
        {/* DEV ONLY — Google API Test */}
        <Route path="/api-test" element={<GoogleApiTest />} />
      </Routes>
    </BrowserRouter>
  );
}
