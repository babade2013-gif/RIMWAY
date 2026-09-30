import { useState, useEffect } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { mapConfig } from '../services/map/mapConfig';
import { PlacesService } from '../services/map/placesService';
import { RoutingService } from '../services/map/routingService';

// Two fixed points in Nouakchott for testing
const POINT_A = { name: 'تفرغ زينة', lat: 18.1030, lng: -15.9780 };
const POINT_B = { name: 'السبخة', lat: 18.0860, lng: -15.9820 };

type TestStatus = 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL';
interface TestResult {
  status: TestStatus;
  message?: string;
}

export default function GoogleApiTestPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({
    mapsLoad: { status: 'PENDING' },
    places: { status: 'PENDING' },
    geocoding: { status: 'PENDING' },
    directions: { status: 'PENDING' },
    distance: { status: 'PENDING' },
    eta: { status: 'PENDING' },
  });
  const [ran, setRan] = useState(false);

  const apiKey = mapConfig.googleMapsApiKey;
  const keyConfigured = Boolean(apiKey && apiKey !== 'GOOGLE_MAPS_API_KEY');

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-test',
    googleMapsApiKey: apiKey || '',
    libraries: ['places'],
  });

  const setResult = (key: string, status: TestStatus, message?: string) => {
    setResults(prev => ({ ...prev, [key]: { status, message } }));
  };

  const runTests = async () => {
    if (!isLoaded) return;
    setRan(true);

    // 1. Maps Load
    try {
      if (window.google?.maps?.Map) {
        setResult('mapsLoad', 'PASS', 'Google Maps JS API loaded successfully');
      } else {
        setResult('mapsLoad', 'FAIL', 'window.google.maps.Map not available');
      }
    } catch (e: any) {
      setResult('mapsLoad', 'FAIL', e?.message || 'Unknown error');
    }

    // 2. Places Search
    setResult('places', 'RUNNING');
    try {
      const results = await PlacesService.searchPlaces('نواكشوط');
      if (results.length > 0) {
        setResult('places', 'PASS', `Found ${results.length} results`);
      } else {
        setResult('places', 'FAIL', 'Empty results — check Places API or billing');
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      setResult('places', 'FAIL', classifyError(msg));
    }

    // 3. Geocoding (Reverse: lat/lng → address)
    setResult('geocoding', 'RUNNING');
    try {
      const geo = await PlacesService.reverseGeocode(POINT_A.lat, POINT_A.lng);
      if (geo?.address && !geo.address.includes('(18.')) {
        setResult('geocoding', 'PASS', `Address: ${geo.address.substring(0, 60)}...`);
      } else if (geo?.address) {
        setResult('geocoding', 'FAIL', 'Fell back to OSM — Google Geocoding may be unauthorized');
      } else {
        setResult('geocoding', 'FAIL', 'No address returned');
      }
    } catch (e: any) {
      setResult('geocoding', 'FAIL', classifyError(e?.message || String(e)));
    }

    // 4. Directions + 5. Distance + 6. ETA (all from RoutingService)
    setResult('directions', 'RUNNING');
    setResult('distance', 'RUNNING');
    setResult('eta', 'RUNNING');
    try {
      const route = await RoutingService.getRoute(POINT_A, POINT_B);
      if (!route) {
        setResult('directions', 'FAIL', 'No route returned');
        setResult('distance', 'FAIL', 'No route');
        setResult('eta', 'FAIL', 'No route');
        return;
      }

      const usedGoogle = route.geometry && !Array.isArray(route.geometry);

      if (usedGoogle) {
        setResult('directions', 'PASS', 'Google Directions API used');
        setResult('distance', 'PASS', `${route.distanceKm} km (via Google)`);
        setResult('eta', 'PASS', `${route.durationMin} min (via Google)`);
      } else {
        // OSRM or Haversine fallback — Google Directions rejected
        setResult('directions', 'FAIL', 'Fell back to OSRM/Haversine — Google Directions unauthorized or not enabled');
        setResult('distance', 'PASS', `${route.distanceKm} km (via OSRM/Haversine fallback)`);
        setResult('eta', 'PASS', `${route.durationMin} min (via OSRM/Haversine fallback)`);
      }
    } catch (e: any) {
      const msg = classifyError(e?.message || String(e));
      setResult('directions', 'FAIL', msg);
      setResult('distance', 'FAIL', msg);
      setResult('eta', 'FAIL', msg);
    }
  };

  // Auto-run once loaded
  useEffect(() => {
    if (isLoaded && !ran && keyConfigured) {
      runTests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const badge = (r: TestResult) => {
    const colors: Record<TestStatus, string> = {
      PENDING: 'bg-gray-100 text-gray-600',
      RUNNING: 'bg-blue-100 text-blue-700 animate-pulse',
      PASS: 'bg-green-100 text-green-800',
      FAIL: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[r.status]}`}>
        {r.status}
      </span>
    );
  };

  const rows = [
    { key: 'mapsLoad',  label: 'Google Maps Load',   api: 'Maps JavaScript API' },
    { key: 'places',    label: 'Places Search',       api: 'Places API' },
    { key: 'geocoding', label: 'Geocoding (Reverse)', api: 'Geocoding API' },
    { key: 'directions',label: 'Directions',          api: 'Directions API' },
    { key: 'distance',  label: 'Distance',            api: 'Directions API' },
    { key: 'eta',       label: 'ETA',                 api: 'Directions API' },
  ];

  return (
    <div className="max-w-3xl mx-auto p-8" dir="rtl">
      <h1 className="text-xl font-bold text-gray-800 mb-1">اختبار Google API Key</h1>
      <p className="text-xs text-gray-500 mb-6">
        بيئة: Development فقط · المفتاح في <code>.env.local</code> · غير مُدرج في Git
      </p>

      {!keyConfigured && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6 text-sm text-amber-800">
          ⚠️ المفتاح الحقيقي لم يُضبط بعد. افتح <code>admin-web/.env.local</code> واستبدل
          <code> GOOGLE_MAPS_API_KEY</code> بالمفتاح الحقيقي، ثم أعد تشغيل السيرفر.
        </div>
      )}

      {loadError && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6 text-sm text-red-800">
          ❌ فشل تحميل Google Maps JS API: <strong>{classifyError(loadError.message)}</strong>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">الاختبار</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">Google API المطلوبة</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">النتيجة</th>
              <th className="px-4 py-3 text-right text-xs font-bold text-gray-500">التفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(r => (
              <tr key={r.key} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{r.label}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.api}</td>
                <td className="px-4 py-3">{badge(results[r.key])}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                  {results[r.key].message || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-xs text-gray-500 space-y-1">
        <p>📍 نقطة الاختبار A: {POINT_A.name} ({POINT_A.lat}, {POINT_A.lng})</p>
        <p>📍 نقطة الاختبار B: {POINT_B.name} ({POINT_B.lat}, {POINT_B.lng})</p>
        <p>🔑 حالة المفتاح: {keyConfigured ? '✅ مُضبط في .env.local' : '⚠️ لم يُضبط بعد (placeholder)'}</p>
        <p>🌐 Google Maps JS: {isLoaded ? '✅ محمّل' : loadError ? '❌ فشل التحميل' : '⏳ جارٍ التحميل...'}</p>
      </div>

      {keyConfigured && isLoaded && (
        <button
          onClick={runTests}
          className="mt-4 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          إعادة تشغيل الاختبارات
        </button>
      )}
    </div>
  );
}

function classifyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalidkeymaperror') || m.includes('invalid key') || m.includes('api_not_activated'))
    return 'API key invalid or not activated';
  if (m.includes('referer') || m.includes('referrer') || m.includes('not authorized'))
    return 'Referrer/Application restriction — key restricted to another app';
  if (m.includes('billing') || m.includes('payment'))
    return 'Billing required — enable billing in Google Cloud';
  if (m.includes('quota'))
    return 'Quota exceeded';
  if (m.includes('cors'))
    return 'CORS error';
  if (m.includes('denied') || m.includes('403'))
    return 'API not enabled or unauthorized (403)';
  if (m.includes('404'))
    return 'Endpoint not found (404)';
  return msg.substring(0, 120);
}
