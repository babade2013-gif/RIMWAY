import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { mapConfig } from '../../services/map/mapConfig';
import type { RideLocation, RouteInfo } from '../../services/map/types';
import AdminRideMap from '../../services/map/AdminRideMap';
import LocationSearchInput from '../../services/map/LocationSearchInput';
import { RoutingService } from '../../services/map/routingService';

interface ServiceType {
  id: string;
  name: string;
}

export default function CreatePhoneRide() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  
  // Location States
  const [pickupLocation, setPickupLocation] = useState<RideLocation | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<RideLocation | null>(null);
  
  // Captain Location (should come from fresh context if tracking active captain)
  const [captainLocation, _setCaptainLocation] = useState<RideLocation | null>(null);

  // Active point for map click
  const [activePointType, setActivePointType] = useState<'PICKUP' | 'DROPOFF'>('PICKUP');

  // Routes
  const [pickupToDropoffRoute, setPickupToDropoffRoute] = useState<RouteInfo | null>(null);
  const [captainToPickupRoute, setCaptainToPickupRoute] = useState<RouteInfo | null>(null);

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    pickupName: '',
    pickupLat: '',
    pickupLng: '',
    dropoffName: '',
    dropoffLat: '',
    dropoffLng: '',
    serviceTypeId: ''
  });

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  // Effect to recalculate routes when locations change
  useEffect(() => {
    const calculateRoutes = async () => {
      if (pickupLocation && dropoffLocation) {
        const route = await RoutingService.getRoute(pickupLocation, dropoffLocation);
        setPickupToDropoffRoute(route);
      } else {
        setPickupToDropoffRoute(null);
      }

      if (captainLocation && pickupLocation) {
        const route = await RoutingService.getRoute(captainLocation, pickupLocation);
        setCaptainToPickupRoute(route);
      } else {
        setCaptainToPickupRoute(null);
      }
    };
    calculateRoutes();
  }, [pickupLocation, dropoffLocation, captainLocation]);

  const fetchServiceTypes = async () => {
    try {
      const response = await apiClient.get('/admin/pricing/service-types');
      setServiceTypes(response.data);
    } catch (err) {
      setError('فشل في تحميل أنواع الخدمة');
    }
  };

  const handlePickupSelect = (location: RideLocation) => {
    setPickupLocation(location);
    setFormData(prev => ({
      ...prev,
      pickupName: location.name || '',
      pickupLat: location.lat.toString(),
      pickupLng: location.lng.toString()
    }));
    setActivePointType('DROPOFF');
  };

  const handleDropoffSelect = (location: RideLocation) => {
    setDropoffLocation(location);
    setFormData(prev => ({
      ...prev,
      dropoffName: location.name || '',
      dropoffLat: location.lat.toString(),
      dropoffLng: location.lng.toString()
    }));
  };

  const handleMapClick = (lat: number, lng: number, placeName?: string) => {
    const location: RideLocation = { lat, lng, name: placeName || `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    
    if (activePointType === 'PICKUP') {
      handlePickupSelect(location);
    } else {
      handleDropoffSelect(location);
    }
  };

  const handlePickupDragEnd = (lat: number, lng: number, placeName?: string) => {
    const location: RideLocation = { lat, lng, name: placeName || `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    handlePickupSelect(location);
  };

  const handleDropoffDragEnd = (lat: number, lng: number, placeName?: string) => {
    const location: RideLocation = { lat, lng, name: placeName || `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    handleDropoffSelect(location);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const idempotencyKey = crypto.randomUUID();
      
      const payload: any = {
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        pickupName: formData.pickupName,
        pickupLat: parseFloat(formData.pickupLat),
        pickupLng: parseFloat(formData.pickupLng),
        dropoffName: formData.dropoffName,
        dropoffLat: parseFloat(formData.dropoffLat),
        dropoffLng: parseFloat(formData.dropoffLng),
        serviceTypeId: formData.serviceTypeId
      };

      if (pickupToDropoffRoute?.distanceKm) {
        payload.distanceKm = Number(pickupToDropoffRoute.distanceKm.toFixed(2));
      }

      await apiClient.post('/admin/rides', payload, {
        headers: {
          'Idempotency-Key': idempotencyKey
        }
      });

      alert('تم إنشاء الرحلة بنجاح');
      navigate('/rides');
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في إنشاء الرحلة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">إنشاء رحلة هاتفية</h1>
        <button
          onClick={() => navigate('/rides')}
          className="text-gray-600 hover:text-gray-900"
        >
          رجوع
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Form */}
        <div className="bg-white shadow sm:rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <h3 className="text-lg leading-6 font-medium text-gray-900">معلومات العميل</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="customerName" className="block text-sm font-medium text-gray-700">الاسم *</label>
                  <input
                    id="customerName"
                    type="text"
                    required
                    className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700">رقم الهاتف *</label>
                  <input
                    id="customerPhone"
                    type="text"
                    required
                    dir="ltr"
                    placeholder="+222..."
                    className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md px-3 py-2 border"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">البحث في الخريطة</h3>
              
              <div className="mt-4 space-y-4">
                <div onClick={() => setActivePointType('PICKUP')} className={`p-2 border rounded ${activePointType === 'PICKUP' ? 'ring-2 ring-blue-500' : ''}`}>
                  <LocationSearchInput 
                    label="نقطة الانطلاق (Pickup) *" 
                    value={formData.pickupName}
                    onChangeName={(val) => setFormData(prev => ({ ...prev, pickupName: val }))}
                    onSelectLocation={handlePickupSelect}
                    placeholder="ابحث عن مكان الانطلاق..."
                  />

                  {!mapConfig.isMapConfigured && (
                    <div className="flex gap-2 mt-2">
                      <input type="number" step="any" placeholder="Lat" required value={formData.pickupLat} onChange={e => setFormData(p => ({...p, pickupLat: e.target.value}))} className="flex-1 text-sm border p-2 rounded" />
                      <input type="number" step="any" placeholder="Lng" required value={formData.pickupLng} onChange={e => setFormData(p => ({...p, pickupLng: e.target.value}))} className="flex-1 text-sm border p-2 rounded" />
                    </div>
                  )}
                </div>

                <div onClick={() => setActivePointType('DROPOFF')} className={`p-2 border rounded ${activePointType === 'DROPOFF' ? 'ring-2 ring-blue-500' : ''}`}>
                  <LocationSearchInput 
                    label="نقطة الوصول (Destination) *" 
                    value={formData.dropoffName}
                    onChangeName={(val) => setFormData(prev => ({ ...prev, dropoffName: val }))}
                    onSelectLocation={handleDropoffSelect}
                    placeholder="ابحث عن الوجهة..."
                  />

                  {!mapConfig.isMapConfigured && (
                    <div className="flex gap-2 mt-2">
                      <input type="number" step="any" placeholder="Lat" required value={formData.dropoffLat} onChange={e => setFormData(p => ({...p, dropoffLat: e.target.value}))} className="flex-1 text-sm border p-2 rounded" />
                      <input type="number" step="any" placeholder="Lng" required value={formData.dropoffLng} onChange={e => setFormData(p => ({...p, dropoffLng: e.target.value}))} className="flex-1 text-sm border p-2 rounded" />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">نوع الخدمة</h3>
              <div className="mt-4">
                <select
                  required
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border"
                  value={formData.serviceTypeId}
                  onChange={(e) => setFormData({ ...formData, serviceTypeId: e.target.value })}
                >
                  <option value="">اختر نوع الخدمة...</option>
                  {serviceTypes.map(st => (
                    <option key={st.id} value={st.id}>{st.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                type="submit"
                disabled={loading || !formData.serviceTypeId}
                className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 w-full"
              >
                {loading ? 'جاري الإنشاء...' : 'تأكيد وإنشاء الرحلة'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Map and Summary */}
        <div className="space-y-6">
          <div className="bg-white shadow sm:rounded-lg p-4">
            <AdminRideMap 
              pickupLocation={pickupLocation}
              dropoffLocation={dropoffLocation}
              captainLocation={captainLocation}
              pickupToDropoffRoute={pickupToDropoffRoute}
              captainToPickupRoute={captainToPickupRoute}
              onMapClick={handleMapClick}
              onPickupDragEnd={handlePickupDragEnd}
              onDropoffDragEnd={handleDropoffDragEnd}
              activePointType={activePointType}
            />
          </div>

          <div className="bg-white shadow sm:rounded-lg p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">ملخص الرحلة</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>حالة الخريطة:</span>
                <span className={mapConfig.isMapConfigured ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {mapConfig.isMapConfigured ? 'مهيأ (Configured)' : 'غير مهيأ (Not Configured)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>مسافة الرحلة (Route):</span>
                <span className="font-medium">
                  {pickupToDropoffRoute ? `${(pickupToDropoffRoute.distanceKm || 0).toFixed(2)} km (Routing)` : 'يحسب في الـ Backend'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>مسافة الكابتن للعميل:</span>
                <span className="font-medium">
                  {captainToPickupRoute ? `${(captainToPickupRoute.distanceKm || 0).toFixed(2)} km` : 'لا يوجد مسار'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>السعر المقدر:</span>
                <span className="font-medium">يحسب في الـ Backend عند الإرسال</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
