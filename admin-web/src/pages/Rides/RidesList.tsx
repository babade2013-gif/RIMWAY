import { useState, useEffect, useMemo } from 'react';
import apiClient from '../../api/client';
import AdminRideMap from '../../services/map/AdminRideMap';
import { RoutingService } from '../../services/map/routingService';
import type { RideLocation, RouteInfo } from '../../services/map/types';
import { 
  Car, 
  MapPin, 
  RotateCcw, 
  CheckCircle2, 
  X, 
  Settings2,
  Search,
  ArrowRight,
  Check,
  Navigation
} from 'lucide-react';
import { PlacesService } from '../../services/map/placesService';

const NOUAKCHOTT_PLACES: RideLocation[] = [
  { name: 'تفرغ زينة، شارع المختار ولد داداه', lat: 18.1030, lng: -15.9780 },
  { name: 'لكصر، قرب السوق المركزي', lat: 18.1150, lng: -15.9580 },
  { name: 'عرفات، شارع المقاومة', lat: 18.0860, lng: -15.9650 },
  { name: 'المطار الدولي القديم، نواكشوط', lat: 18.0970, lng: -15.9480 },
  { name: 'السبخة، وسط المدينة', lat: 18.0860, lng: -15.9820 },
  { name: 'دار النعيم، قرب المستشفى الوطني', lat: 18.1050, lng: -15.9320 },
  { name: 'تيارت، قرب البريد', lat: 18.1250, lng: -15.9450 },
];

export default function RidesList() {
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('الكل');
  const [showNewRideModal, setShowNewRideModal] = useState(false);
  const [showCreatedToast, setShowCreatedToast] = useState(false);
  const [mapPickMode, setMapPickMode] = useState<'pickup' | 'destination' | null>(null);

  // Map Search & Autocomplete
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapSearchResults, setMapSearchResults] = useState<RideLocation[]>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);

  useEffect(() => {
    if (!mapSearchQuery.trim()) {
      setMapSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingMap(true);
      try {
        const results = await PlacesService.searchPlaces(mapSearchQuery);
        setMapSearchResults(results);
      } catch {
        setMapSearchResults([]);
      } finally {
        setIsSearchingMap(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mapSearchQuery]);

  // Locations for New Ride
  const [pickup, setPickup] = useState<RideLocation>(NOUAKCHOTT_PLACES[0]);
  const [destination, setDestination] = useState<RideLocation>(NOUAKCHOTT_PLACES[1]);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pricing settings
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [baseFare, setBaseFare] = useState<number>(0);
  const [perKm, setPerKm] = useState<number>(25);
  const [minFare, setMinFare] = useState<number>(50);
  const [commissionRate, setCommissionRate] = useState<number>(15);
  const [serviceVersion, setServiceVersion] = useState<number>(1);
  const [selectedRideForDetails, setSelectedRideForDetails] = useState<any | null>(null);
  const [isCancellingRide, setIsCancellingRide] = useState<boolean>(false);

  // Fetch Rides
  const fetchRides = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/admin/rides?limit=50');
      const list = Array.isArray(data) ? data : (data.data || []);
      setRides(list);
    } catch (err) {
      console.error('Failed to fetch rides:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Pricing / Service Types
  const fetchPricing = async () => {
    try {
      const { data } = await apiClient.get('/admin/pricing/service-types');
      const list = Array.isArray(data) ? data : [];
      setServiceTypes(list);
      if (list.length > 0) {
        setSelectedServiceId(list[0].id);
        setServiceVersion(list[0].version || 1);
        setBaseFare(list[0].baseFare != null ? Number(list[0].baseFare) : 0);
        setPerKm(list[0].perKm != null ? Number(list[0].perKm) : 25);
        setMinFare(list[0].minFare != null ? Number(list[0].minFare) : 50);
        setCommissionRate(list[0].serviceFee != null ? Number(list[0].serviceFee) : 15);
      }
    } catch (err) {
      console.error('Failed to fetch pricing:', err);
    }
  };

  useEffect(() => {
    fetchRides();
    fetchPricing();
    const interval = setInterval(() => {
      apiClient.get('/admin/rides?limit=50').then(({ data }) => {
        const list = Array.isArray(data) ? data : (data.data || []);
        setRides(list);
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Handle service type change
  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    const selected = serviceTypes.find((s) => s.id === serviceId);
    if (selected) {
      setServiceVersion(selected.version || 1);
      setBaseFare(selected.baseFare != null ? Number(selected.baseFare) : 0);
      setPerKm(selected.perKm != null ? Number(selected.perKm) : 25);
      setMinFare(selected.minFare != null ? Number(selected.minFare) : 50);
      setCommissionRate(selected.serviceFee != null ? Number(selected.serviceFee) : 15);
    }
  };

  // Update Route when pickup or destination changes
  useEffect(() => {
    const calc = async () => {
      if (pickup && destination) {
        const info = await RoutingService.getRoute(pickup, destination);
        setRouteInfo(info);
      }
    };
    calc();
  }, [pickup, destination]);

  // Calculate estimated distance and fare (exact unification with captain)
  const distanceKm = useMemo(() => {
    if (routeInfo?.distanceKm) return routeInfo.distanceKm;
    const toRad = (v: number) => (v * Math.PI) / 180;
    const dLat = toRad(destination.lat - pickup.lat);
    const dLng = toRad(destination.lng - pickup.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(pickup.lat)) * Math.cos(toRad(destination.lat)) * Math.sin(dLng / 2) ** 2;
    const d = 6371 * 2 * Math.asin(Math.sqrt(a));
    return Math.max(1, Math.round(d * 10) / 10);
  }, [pickup, destination, routeInfo]);

  const durationMin = useMemo(() => {
    if (routeInfo?.durationMin) return routeInfo.durationMin;
    return Math.max(2, Math.round(distanceKm * 2.5));
  }, [distanceKm, routeInfo]);

  const estimatedFare = useMemo(() => {
    const subtotal = Math.ceil(Number(baseFare || 0) + (distanceKm * Number(perKm || 0)));
    return Math.max(Number(minFare || 0), subtotal);
  }, [distanceKm, baseFare, perKm, minFare]);

  // Handle map click
  const handleMapClick = async (lat: number, lng: number, placeName?: string) => {
    if (!mapPickMode) return;
    let name = placeName;
    if (!name || name.startsWith('نقطة مختارة') || name.startsWith('موقع محدد')) {
      const geo = await PlacesService.reverseGeocode(lat, lng);
      if (geo?.name) name = geo.name;
    }
    const loc: RideLocation = {
      name: name || `موقع (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      lat,
      lng
    };

    if (mapPickMode === 'pickup') {
      setPickup(loc);
      setMapPickMode('destination');
    } else if (mapPickMode === 'destination') {
      setDestination(loc);
    }
  };

  // Handle selecting location from search results on map
  const handleSelectMapSearchResult = (loc: RideLocation) => {
    if (mapPickMode === 'pickup') {
      setPickup(loc);
      setMapPickMode('destination');
    } else if (mapPickMode === 'destination') {
      setDestination(loc);
    }
    setMapSearchQuery('');
    setMapSearchResults([]);
  };

  // Save Pricing on blur
  const handleSavePricing = async () => {
    if (!selectedServiceId) return;
    try {
      const res = await apiClient.put(`/admin/pricing/service-types/${selectedServiceId}`, {
        baseFare: Number(baseFare),
        perKm: Number(perKm),
        minFare: Number(minFare),
        serviceFee: Number(commissionRate),
        version: serviceVersion
      });
      if (res.data?.version) {
        setServiceVersion(res.data.version);
      }
    } catch (err) {
      console.error('Failed to update pricing:', err);
    }
  };

  // Submit Manual Ride (Sends unified price and distance to backend)
  const handleCreateRide = async () => {
    if (!customerPhone.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const serviceId = selectedServiceId || (serviceTypes.length > 0 ? serviceTypes[0].id : '');
      const payload = {
        customerName: customerName.trim() || 'عميل هاتفي',
        customerPhone: customerPhone.trim(),
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        pickupName: pickup.name || 'نواكشوط - نقطة الانطلاق',
        dropoffLat: destination.lat,
        dropoffLng: destination.lng,
        dropoffName: destination.name || 'نواكشوط - وجهة الوصول',
        serviceTypeId: serviceId,
        estimatedFare: Number(estimatedFare),
        distanceKm: Number(distanceKm),
      };

      await apiClient.post('/admin/rides', payload, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });

      setShowNewRideModal(false);
      setShowCreatedToast(true);
      setCustomerPhone('');
      setCustomerName('');
      fetchRides();
      setTimeout(() => setShowCreatedToast(false), 5000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'خطأ في إنشاء الرحلة');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered rides
  const filteredRides = useMemo(() => {
    if (filterStatus === 'الكل') return rides;
    if (filterStatus === 'نشطة') {
      return rides.filter(r => ['DRIVER_ASSIGNED', 'ACCEPTED', 'DRIVER_ARRIVED', 'ARRIVED', 'PASSENGER_BOARDED', 'IN_PROGRESS'].includes(r.status));
    }
    if (filterStatus === 'بانتظار كابتن') {
      return rides.filter(r => ['SEARCHING', 'REQUESTED'].includes(r.status));
    }
    if (filterStatus === 'مكتملة') {
      return rides.filter(r => r.status === 'COMPLETED');
    }
    if (filterStatus === 'ملغاة') {
      return rides.filter(r => r.status && r.status.includes('CANCEL'));
    }
    return rides;
  }, [rides, filterStatus]);

  const activeRidesCount = rides.filter(r => ['DRIVER_ASSIGNED', 'ACCEPTED', 'DRIVER_ARRIVED', 'ARRIVED', 'PASSENGER_BOARDED', 'IN_PROGRESS'].includes(r.status)).length;
  const waitingRidesCount = rides.filter(r => ['SEARCHING', 'REQUESTED'].includes(r.status)).length;
  const cancelledRidesCount = rides.filter(r => r.status && r.status.includes('CANCEL')).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SEARCHING':
      case 'REQUESTED':
        return { label: 'بانتظار كابتن', color: 'amber', bg: 'bg-amber-100 text-amber-800' };
      case 'DRIVER_ASSIGNED':
      case 'ACCEPTED':
        return { label: 'تم القبول (كابتن معين)', color: 'blue', bg: 'bg-blue-100 text-blue-800' };
      case 'DRIVER_ARRIVED':
      case 'ARRIVED':
        return { label: 'وصل الكابتن', color: 'blue', bg: 'bg-indigo-100 text-indigo-800' };
      case 'PASSENGER_BOARDED':
        return { label: 'ركب الزبون', color: 'blue', bg: 'bg-purple-100 text-purple-800' };
      case 'IN_PROGRESS':
        return { label: 'في الطريق', color: 'blue', bg: 'bg-cyan-100 text-cyan-800' };
      case 'COMPLETED':
        return { label: 'مكتملة', color: 'green', bg: 'bg-green-100 text-green-800' };
      case 'CANCELLED_BY_DRIVER':
        return { label: 'ملغاة من الكابتن', color: 'slate', bg: 'bg-rose-100 text-rose-800' };
      case 'CANCELLED_BY_ADMIN':
        return { label: 'ملغاة من الإدارة', color: 'slate', bg: 'bg-rose-100 text-rose-800' };
      case 'CANCELLED_BY_PASSENGER':
        return { label: 'ملغاة من الزبون', color: 'slate', bg: 'bg-rose-100 text-rose-800' };
      case 'CANCELLED':
        return { label: 'ملغاة', color: 'slate', bg: 'bg-gray-100 text-gray-800' };
      default:
        return { label: status, color: 'slate', bg: 'bg-gray-100 text-gray-800' };
    }
  };

  const handleAdminCancelRide = async (ride: any) => {
    const reason = prompt('يرجى كتابة سبب إلغاء الرحلة من الإدارة:', 'إلغاء بناء على طلب العميل');
    if (!reason || !reason.trim()) return;
    setIsCancellingRide(true);
    try {
      await apiClient.post(`/admin/rides/${ride.id}/cancel`, {
        stateVersion: ride.stateVersion || 1,
        reason: reason.trim()
      });
      alert('تم إلغاء الرحلة بنجاح');
      fetchRides();
      setSelectedRideForDetails(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل إلغاء الرحلة');
    } finally {
      setIsCancellingRide(false);
    }
  };

  return (
    <section className="ride-management-page" dir="rtl">
      {/* 1. Full Screen Interactive Map */}
      <div className="ride-management-map">
        <AdminRideMap
          pickupLocation={pickup}
          dropoffLocation={destination}
          captainLocation={null}
          pickupToDropoffRoute={routeInfo}
          activePointType={mapPickMode === 'pickup' ? 'PICKUP' : mapPickMode === 'destination' ? 'DROPOFF' : null}
          onMapClick={handleMapClick}
          fallbackToOsm={true}
        />

        <div className="ride-map-overlay">
          <div className="ride-map-live">
            <span />
            خريطة الرحلات · تحديث مباشر
          </div>

          {showCreatedToast && (
            <div className="ride-created-toast">
              <CheckCircle2 size={16} />
              تم إنشاء الرحلة وحفظها بنجاح · الدفع نقدًا للكابتن
            </div>
          )}

          {mapPickMode && (
            <>
              {/* Top Floating Controls & Search Bar */}
              <div className="absolute top-4 left-4 right-4 z-20 flex flex-col items-center pointer-events-auto max-w-2xl mx-auto">
                {/* Point Switcher Tabs & Back */}
                <div className="bg-white/95 backdrop-blur-md shadow-xl border border-blue-200 rounded-2xl p-2 w-full flex flex-wrap gap-2 justify-between items-center mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                    <button
                      type="button"
                      onClick={() => setMapPickMode('pickup')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        mapPickMode === 'pickup'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-white inline-block"></span>
                      الانطلاق (أ): {pickup.name ? pickup.name.slice(0, 18) : 'اختر'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setMapPickMode('destination')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        mapPickMode === 'destination'
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-white inline-block"></span>
                      الوصول (ب): {destination.name ? destination.name.slice(0, 18) : 'اختر'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMapPickMode(null);
                      setShowNewRideModal(true);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors shrink-0"
                  >
                    عودة للنموذج
                  </button>
                </div>

                {/* Search Bar Input */}
                <div className="relative w-full">
                  <div className="bg-white/95 backdrop-blur-md shadow-xl border border-gray-200 rounded-2xl flex items-center px-3 py-2 w-full">
                    <Search size={16} className="text-gray-400 ml-2 shrink-0" />
                    <input
                      type="text"
                      value={mapSearchQuery}
                      onChange={(e) => setMapSearchQuery(e.target.value)}
                      placeholder={`ابحث عن ${mapPickMode === 'pickup' ? 'نقطة الانطلاق (أ)' : 'نقطة الوصول (ب)'} بالاسم أو المعلم (Google / OpenStreetMap)...`}
                      className="w-full text-xs text-gray-800 bg-transparent outline-none"
                    />
                    {isSearchingMap && (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0 ml-2"></div>
                    )}
                    {mapSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setMapSearchQuery('')}
                        className="p-1 text-gray-400 hover:text-gray-600 shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Autocomplete Dropdown */}
                  {mapSearchResults.length > 0 && (
                    <div className="absolute top-full mt-1.5 left-0 right-0 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-30 max-h-60 overflow-y-auto">
                      {mapSearchResults.map((loc, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelectMapSearchResult(loc)}
                          className="w-full text-right px-4 py-2.5 text-xs hover:bg-blue-50 border-b border-gray-100 last:border-b-0 flex items-center justify-between group transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-blue-500 shrink-0" />
                            <div>
                              <strong className="block text-gray-800 text-xs">{loc.name}</strong>
                              {loc.address && loc.address !== loc.name && (
                                <span className="text-[10px] text-gray-400 block truncate max-w-md">{loc.address}</span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            تحديد الموقع
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Map Click Hint */}
                <div className="bg-black/60 backdrop-blur-md text-white text-[11px] font-medium px-4 py-1 rounded-full mt-2 shadow-md flex items-center gap-2">
                  <Navigation size={12} className="text-blue-400 animate-pulse" />
                  <span>انقر مباشرة على الخريطة لتحديد {mapPickMode === 'pickup' ? 'نقطة الانطلاق (أ)' : 'نقطة الوصول (ب)'} أو ابحث أعلاه</span>
                </div>
              </div>

              {/* Bottom Floating Route & Fare Card */}
              {pickup.lat && destination.lat && (
                <div className="absolute bottom-6 left-4 right-4 z-20 pointer-events-auto max-w-xl mx-auto">
                  <div className="bg-white/95 backdrop-blur-md shadow-2xl border border-blue-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="text-xs font-bold text-gray-700 truncate" title={pickup.name}>
                          {pickup.name}
                        </span>
                        <ArrowRight size={14} className="text-gray-400 shrink-0 mx-1" />
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
                        <span className="text-xs font-bold text-gray-700 truncate" title={destination.name}>
                          {destination.name}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-blue-50/80 rounded-xl p-2.5 mb-2 text-center">
                      <div>
                        <span className="text-[10px] text-gray-500 block">مسافة المسار</span>
                        <b className="text-xs font-black text-blue-950">{distanceKm} كم</b>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">الوقت التقديري</span>
                        <b className="text-xs font-black text-blue-950">{durationMin} دقيقة</b>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block">السعر المقدر</span>
                        <b className="text-xs font-black text-blue-700">{estimatedFare} MRU</b>
                      </div>
                    </div>
                    <div className="text-[10px] text-blue-700 bg-blue-100/50 rounded-lg py-1 px-2 mb-3 text-center">
                      الحساب: {distanceKm} كم × {perKm} أوقية/كم {baseFare > 0 ? `+ ${baseFare} فتح العداد` : ''} = {estimatedFare} MRU (حد أدنى: {minFare} MRU)
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMapPickMode(null);
                          setShowNewRideModal(true);
                        }}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                      >
                        <Check size={15} />
                        متابعة إطلاق الرحلة بهذا المسار والسعر
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMapPickMode(null);
                          setShowNewRideModal(true);
                        }}
                        className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-all"
                      >
                        عودة
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2. Side Operations Control Panel */}
      {!mapPickMode && (
        <aside className="ride-management-side">
          <div className="ride-side-head">
            <div>
              <div className="panel-kicker">
                <Car size={14} className="text-[#2364d2]" />
                إدارة الرحلات
              </div>
              <h2>مركز الرحلات</h2>
              <p>أنشئ الرحلات وتابع الأسطول وحركة العمليات لحظة بلحظة.</p>
            </div>
            <button
              type="button"
              className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              onClick={fetchRides}
              title="تحديث البيانات"
            >
              <RotateCcw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* New Ride Action Button */}
          <button
            type="button"
            className="new-ride-button"
            onClick={() => setShowNewRideModal(true)}
          >
            <span>＋</span> رحلة جديدة
          </button>

          {/* KPIs */}
          <div className="ride-side-kpis grid grid-cols-3 gap-2">
            <div>
              <span>نشطة</span>
              <strong>{activeRidesCount}</strong>
            </div>
            <div>
              <span>بانتظار كابتن</span>
              <strong>{waitingRidesCount}</strong>
            </div>
            <div>
              <span>ملغاة</span>
              <strong className="text-rose-600">{cancelledRidesCount}</strong>
            </div>
          </div>

          {/* Active Rides Section */}
          <div className="ride-side-section">
            <div className="ride-side-title flex justify-between items-center mb-3">
              <strong className="text-[#20324c] text-sm">متابعة الرحلات المباشرة</strong>
              <span className="text-xs text-gray-500">{filteredRides.length} رحلة</span>
            </div>

            <div className="ride-filter-pills flex flex-wrap gap-1 mb-3">
              {['الكل', 'نشطة', 'بانتظار كابتن', 'مكتملة', 'ملغاة'].map((status) => (
                <button
                  key={status}
                  type="button"
                  className={filterStatus === status ? 'active' : ''}
                  onClick={() => setFilterStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="ride-mini-list space-y-2 max-h-[340px] overflow-y-auto">
              {filteredRides.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">لا توجد رحلات مطابقة</div>
              ) : (
                filteredRides.slice(0, 20).map((r) => {
                  const badge = getStatusBadge(r.status);
                  const code = r.id ? `RW-${r.id.substring(0, 5).toUpperCase()}` : 'RW-00000';
                  const isCancelled = r.status && r.status.includes('CANCEL');
                  const fareDisplay = r.finalFare || r.estimatedFare;
                  return (
                    <div
                      key={r.id}
                      className="p-2.5 bg-white hover:bg-blue-50/60 rounded-xl border border-gray-100 shadow-sm transition-all cursor-pointer space-y-1.5"
                      onClick={() => {
                        setSelectedRideForDetails(r);
                        if (r.pickupLat && r.pickupLng) {
                          setPickup({
                            name: r.pickupName || 'نقطة الانطلاق',
                            lat: r.pickupLat,
                            lng: r.pickupLng
                          });
                        }
                        if (r.dropoffLat && r.dropoffLng) {
                          setDestination({
                            name: r.dropoffName || 'نقطة الوصول',
                            lat: r.dropoffLat,
                            lng: r.dropoffLng
                          });
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`mini-status ${badge.color}`} />
                          <strong className="text-xs text-[#20324c]">{code}</strong>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-600 truncate">
                        {r.pickupName || 'الانطلاق'} ← {r.dropoffName || 'الوصول'}
                      </div>

                      {/* Captain info if assigned */}
                      {r.driverName && (
                        <div className="text-[10px] text-blue-700 bg-blue-50/80 px-2 py-1 rounded-md flex items-center justify-between">
                          <span>👤 الكابتن: {r.driverName}</span>
                          <span>📞 {r.driverPhone || ''}</span>
                        </div>
                      )}

                      {/* Cancel reason if cancelled */}
                      {isCancelled && (
                        <div className="text-[10px] text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-200">
                          <strong>سبب الإلغاء:</strong> {r.cancelReason || 'غير محدد'}
                          {r.driverName && <span className="block text-[9px] text-rose-600">الكابتن: {r.driverName}</span>}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1 border-t border-gray-50 text-[10px] text-gray-500">
                        <span>المسافة: {r.distanceKm ? `${r.distanceKm} كم` : '---'}</span>
                        <span className="font-bold text-[#2364d2] text-xs">
                          {fareDisplay ? `${Number(fareDisplay)} MRU` : '---'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Pricing & Commission Settings */}
          <div className="ride-side-section fare-settings">
            <div className="ride-side-title flex justify-between items-center mb-3">
              <strong className="text-[#20324c] text-sm">عداد السعر والتعرفة</strong>
              <Settings2 size={15} className="text-gray-400" />
            </div>

            <label className="mb-2.5 block">
              <span className="text-xs text-gray-500 block mb-1">فتح العداد (السعر الأساسي)</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  value={baseFare}
                  onChange={(e) => setBaseFare(Number(e.target.value) || 0)}
                  onBlur={handleSavePricing}
                />
                <b className="text-xs text-gray-500 whitespace-nowrap">MRU</b>
              </div>
            </label>

            <label className="mb-2.5 block">
              <span className="text-xs text-gray-500 block mb-1">سعر الكيلومتر</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  value={perKm}
                  onChange={(e) => setPerKm(Number(e.target.value) || 0)}
                  onBlur={handleSavePricing}
                />
                <b className="text-xs text-gray-500 whitespace-nowrap">MRU / كم</b>
              </div>
            </label>

            <label className="mb-2.5 block">
              <span className="text-xs text-gray-500 block mb-1">الحد الأدنى للمشوار</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  value={minFare}
                  onChange={(e) => setMinFare(Number(e.target.value) || 0)}
                  onBlur={handleSavePricing}
                />
                <b className="text-xs text-gray-500 whitespace-nowrap">MRU</b>
              </div>
            </label>

            <label className="mb-2.5 block">
              <span className="text-xs text-gray-500 block mb-1">عمولة المنصة من الكابتن</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 outline-none focus:border-blue-500"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Number(e.target.value) || 0)}
                  onBlur={handleSavePricing}
                />
                <b className="text-xs text-gray-500 whitespace-nowrap">%</b>
              </div>
            </label>

            <small className="text-[10px] text-gray-400 leading-relaxed block mt-2">
              الزبون يدفع نقدًا للكابتن. بعد اكتمال الرحلة تخصم العمولة من رصيد الكابتن، وعند وصوله للصفر يتوقف عن استقبال الرحلات.
            </small>
          </div>
        </aside>
      )}

      {/* 3. New Ride Dialog Modal ("إنشاء رحلة يدوية") */}
      {showNewRideModal && (
        <div className="new-ride-modal">
          <div className="new-ride-dialog">
            <button
              type="button"
              className="new-ride-close"
              onClick={() => setShowNewRideModal(false)}
            >
              <X size={18} />
            </button>

            <div className="panel-kicker">
              <Car size={14} className="text-[#2364d2]" />
              إنشاء رحلة يدوية
            </div>
            <h2>رحلة جديدة</h2>
            <p>ابحث عن العنوان أو اختر اقتراحًا لتحديد المسار وحساب السعر تلقائياً.</p>

            {/* Customer Phone */}
            <label className="ride-form-field">
              <span>رقم الزبون *</span>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="مثال: +222 45 00 00 00"
                dir="ltr"
              />
            </label>

            {/* Customer Name */}
            <label className="ride-form-field">
              <span>اسم الزبون (اختياري)</span>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="مثال: محمد ولد أحمد"
              />
            </label>

            {/* Pickup Location */}
            <div className="location-select-row">
              <div className="flex-1">
                <span className="text-[11px] font-bold text-gray-600 block mb-1">نقطة الانطلاق · أ</span>
                <select
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white"
                  value={pickup.name}
                  onChange={(e) => {
                    const place = NOUAKCHOTT_PLACES.find((p) => p.name === e.target.value);
                    if (place) setPickup(place);
                  }}
                >
                  {NOUAKCHOTT_PLACES.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="map-pick-button self-end"
                onClick={() => {
                  setShowNewRideModal(false);
                  setMapPickMode('pickup');
                }}
              >
                <MapPin size={13} /> من الخريطة
              </button>
            </div>

            {/* Destination Location */}
            <div className="location-select-row">
              <div className="flex-1">
                <span className="text-[11px] font-bold text-gray-600 block mb-1">نقطة الوصول · ب</span>
                <select
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white"
                  value={destination.name}
                  onChange={(e) => {
                    const place = NOUAKCHOTT_PLACES.find((p) => p.name === e.target.value);
                    if (place) setDestination(place);
                  }}
                >
                  {NOUAKCHOTT_PLACES.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="map-pick-button self-end"
                onClick={() => {
                  setShowNewRideModal(false);
                  setMapPickMode('destination');
                }}
              >
                <MapPin size={13} /> من الخريطة
              </button>
            </div>

            {/* Service Type Selection */}
            {serviceTypes.length > 1 && (
              <div className="mt-2">
                <span className="text-[11px] font-bold text-gray-600 block mb-1">نوع الخدمة</span>
                <select
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs bg-white"
                  value={selectedServiceId}
                  onChange={(e) => handleServiceChange(e.target.value)}
                >
                  {serviceTypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.baseFare} MRU أساسي)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Geocode indicator */}
            <div className="ride-geocode-note">
              <MapPin size={13} />
              <span>البحث الجغرافي متصل · الاقتراحات من خريطة نواكشوط</span>
            </div>

            {/* Live Pricing Preview */}
            <div className="ride-price-preview">
              <div>
                <span>المسافة الفعلية</span>
                <strong>{distanceKm} كم</strong>
              </div>
              <div>
                <span>المدة التقريبية</span>
                <strong>
                  {durationMin} <small>دقيقة</small>
                </strong>
              </div>
              <div>
                <span>السعر التلقائي</span>
                <strong>
                  {estimatedFare} <small>MRU</small>
                </strong>
              </div>
            </div>
            <div className="text-[10px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg py-1 px-2.5 mb-3 text-center">
              حساب التسعيرة: {distanceKm} كم × {perKm} أوقية/كم {baseFare > 0 ? `+ ${baseFare} فتح العداد` : ''} = <strong>{estimatedFare} MRU</strong> (حد أدنى: {minFare} MRU)
            </div>

            {/* Submit Button */}
            <button
              type="button"
              className="create-ride-submit"
              disabled={!customerPhone.trim() || isSubmitting}
              onClick={handleCreateRide}
            >
              {isSubmitting ? 'جاري إنشاء الرحلة...' : 'تأكيد إنشاء الرحلة ↵'}
            </button>
          </div>
        </div>
      )}

      {/* 4. Full Ride Details Modal */}
      {selectedRideForDetails && (
        <div className="new-ride-modal" onClick={() => setSelectedRideForDetails(null)}>
          <div className="new-ride-dialog max-w-lg" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="new-ride-close"
              onClick={() => setSelectedRideForDetails(null)}
            >
              <X size={18} />
            </button>

            <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-gray-500 block">تفاصيل المشوار</span>
                <h3 className="text-base font-black text-gray-900">
                  {selectedRideForDetails.id ? `RW-${selectedRideForDetails.id.substring(0, 8).toUpperCase()}` : 'RW-000000'}
                </h3>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-bold ${getStatusBadge(selectedRideForDetails.status).bg}`}>
                {getStatusBadge(selectedRideForDetails.status).label}
              </span>
            </div>

            {/* Cancellation Alert Banner */}
            {selectedRideForDetails.status && selectedRideForDetails.status.includes('CANCEL') && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-rose-800 font-black">
                  <span>⚠️</span>
                  <span>الرحلة ملغاة</span>
                </div>
                <div className="text-rose-700">
                  <strong>سبب الإلغاء: </strong>
                  <span className="font-semibold">{selectedRideForDetails.cancelReason || 'غير محدد في النظام'}</span>
                </div>
                {selectedRideForDetails.driverName && (
                  <div className="text-rose-600 text-[11px]">
                    الكابتن المكلف وقت الإلغاء: {selectedRideForDetails.driverName} ({selectedRideForDetails.driverPhone || ''})
                  </div>
                )}
              </div>
            )}

            {/* Route Details */}
            <div className="space-y-2 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200/60 text-xs">
              <div className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">نقطة الانطلاق</span>
                  <strong className="text-gray-800">{selectedRideForDetails.pickupName || 'نواكشوط'}</strong>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 shrink-0"></span>
                <div>
                  <span className="text-[10px] text-gray-400 block font-semibold">نقطة الوصول</span>
                  <strong className="text-gray-800">{selectedRideForDetails.dropoffName || 'نواكشوط'}</strong>
                </div>
              </div>
            </div>

            {/* Customer & Captain Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                <span className="text-[10px] text-gray-400 block mb-1 font-semibold">بيانات الزبون</span>
                <strong className="text-gray-800 block">{selectedRideForDetails.customerName || selectedRideForDetails.passenger?.name || 'عميل هاتفي'}</strong>
                <span className="text-gray-600 block mt-0.5" dir="ltr">{selectedRideForDetails.customerPhone || selectedRideForDetails.passenger?.phone || '---'}</span>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
                <span className="text-[10px] text-blue-600 block mb-1 font-semibold">الكابتن المكلف</span>
                {selectedRideForDetails.driverName ? (
                  <>
                    <strong className="text-blue-950 block">{selectedRideForDetails.driverName}</strong>
                    <span className="text-blue-800 block mt-0.5" dir="ltr">{selectedRideForDetails.driverPhone || '---'}</span>
                    {selectedRideForDetails.driverVehicle && (
                      <span className="text-[10px] text-blue-600 block mt-1">🚗 {selectedRideForDetails.driverVehicle}</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400 italic">لم يتم التعيين بعد</span>
                )}
              </div>
            </div>

            {/* Fare Summary */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs mb-4">
              <div>
                <span className="text-[10px] text-emerald-700 block font-semibold">الأجرة الإجمالية</span>
                <strong className="text-base font-black text-emerald-900">
                  {(selectedRideForDetails.finalFare || selectedRideForDetails.estimatedFare)
                    ? `${Number(selectedRideForDetails.finalFare || selectedRideForDetails.estimatedFare)} MRU`
                    : '---'}
                </strong>
              </div>
              <div className="text-left text-emerald-800">
                <span>المسافة: {selectedRideForDetails.distanceKm ? `${selectedRideForDetails.distanceKm} كم` : '---'}</span>
              </div>
            </div>

            {/* Admin Cancel Action if ride is still active */}
            {!selectedRideForDetails.status.includes('CANCEL') && selectedRideForDetails.status !== 'COMPLETED' && (
              <button
                type="button"
                disabled={isCancellingRide}
                onClick={() => handleAdminCancelRide(selectedRideForDetails)}
                className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 transition-colors text-xs"
              >
                {isCancellingRide ? 'جاري الإلغاء...' : 'إلغاء الرحلة من الإدارة (مع ذكر السبب)'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
