import { useEffect, useState } from 'react';
import apiClient from '../../api/client';

interface DashboardStats {
  todayRides: number;
  completedRides: number;
  cancelledRides: number;
  onlineCaptains: number;
  availableCaptains: number;
  pendingCaptains: number;
  suspendedCaptains: number;
  grossFare: number;
  commission: number;
  netEarnings: number;
  totalTripValue?: number;
  totalCommission?: number;
  totalCaptainWallets?: number;
  exhaustedCaptainsCount?: number;
  pendingTopUpsCount?: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      const res = await apiClient.get('/admin/dashboard/stats');
      setStats(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تحميل بيانات لوحة التحكم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <div className="text-center py-12 text-gray-500 font-medium">جاري تحميل إحصائيات النظام...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center my-6">
        {error}
      </div>
    );
  }

  const tripValue = stats?.totalTripValue ?? stats?.grossFare ?? 0;
  const commissionVal = stats?.totalCommission ?? stats?.commission ?? 0;
  const walletsVal = stats?.totalCaptainWallets ?? 0;
  const exhaustedVal = stats?.exhaustedCaptainsCount ?? 0;
  const pendingTopUps = stats?.pendingTopUpsCount ?? 0;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم التشغيلية</h1>
          <p className="text-sm text-gray-500 mt-1">
            إحصائيات اليوم المباشرة ونظام المحفظة التشغيلية (GMT)
          </p>
        </div>
        <button
          onClick={fetchStats}
          className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition"
        >
          تحديث البيانات
        </button>
      </div>

      {/* Financial & Operating Wallet Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">المؤشرات المالية والمحفظة التشغيلية</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">إجمالي قيمة الرحلات (نقداً)</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-extrabold text-gray-900">{tripValue.toLocaleString()}</span>
              <span className="mr-2 text-sm text-gray-500">MRU</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">المبلغ المدفوع نقداً من الركاب للكباتن مباشرة</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">عمولة المنصة المخصومة</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-extrabold text-blue-600">{commissionVal.toLocaleString()}</span>
              <span className="mr-2 text-sm text-gray-500">MRU</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">إجمالي عمولات ريم واي المخصومة من المحافظ</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">أرصدة محافظ الكباتن الحالية</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-extrabold text-emerald-700">{walletsVal.toLocaleString()}</span>
              <span className="mr-2 text-sm text-gray-500">MRU</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">الرصيد التشغيلي الإجمالي المسبق للكباتن</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-rose-600 uppercase tracking-wider">كباتن متوقفون لنفاد الرصيد</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-extrabold text-rose-600">{exhaustedVal}</span>
              <span className="mr-2 text-sm text-gray-500">كابتن</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">رصيدهم صفر أو سالب (محظورون تلقائياً)</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">طلبات الشحن المعلقة</span>
            <div className="mt-2 flex items-baseline">
              <span className="text-3xl font-extrabold text-amber-600">{pendingTopUps}</span>
              <span className="mr-2 text-sm text-gray-500">طلب</span>
            </div>
            <p className="text-xs text-gray-400 mt-2">طلبات شحن واتساب بانتظار الاعتماد</p>
          </div>
        </div>
      </div>

      {/* Ride Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">حركة الرحلات (اليوم)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-gray-400">إجمالي طلبات الرحلات</span>
            <div className="text-3xl font-bold text-gray-900 mt-2">{stats?.todayRides || 0}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-green-600">الرحلات المكتملة</span>
            <div className="text-3xl font-bold text-green-700 mt-2">{stats?.completedRides || 0}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-red-600">الرحلات الملغاة</span>
            <div className="text-3xl font-bold text-red-700 mt-2">{stats?.cancelledRides || 0}</div>
          </div>
        </div>
      </div>

      {/* Captain Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">حالة الكباتن</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-green-700">الكباتن المتصلين</span>
            <div className="text-3xl font-bold text-green-800 mt-2">{stats?.onlineCaptains || 0}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-blue-700">الكباتن المتاحين</span>
            <div className="text-3xl font-bold text-blue-800 mt-2">{stats?.availableCaptains || 0}</div>
            <p className="text-xs text-gray-400 mt-1">متصلين بدون رحلات نشطة</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-yellow-600">طلبات انضمام قيد المراجعة</span>
            <div className="text-3xl font-bold text-yellow-700 mt-2">{stats?.pendingCaptains || 0}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <span className="text-xs font-semibold text-red-600">كباتن معلقين</span>
            <div className="text-3xl font-bold text-red-700 mt-2">{stats?.suspendedCaptains || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
