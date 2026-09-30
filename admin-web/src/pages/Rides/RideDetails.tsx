import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { format } from 'date-fns';

export default function RideDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ride, setRide] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchRide = async () => {
    try {
      const { data } = await apiClient.get(`/admin/rides/${id}`);
      setRide(data);
    } catch (err) {
      setError('فشل في جلب بيانات الرحلة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRide();
  }, [id]);

  const handleCancel = async () => {
    const reason = window.prompt('سبب الإلغاء:');
    if (!reason) return;

    setCancelLoading(true);
    try {
      await apiClient.post(`/admin/rides/${id}/cancel`, {
        stateVersion: ride.stateVersion,
        reason
      });
      await fetchRide();
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert('حالة الرحلة تغيرت، يرجى تحديث الصفحة والمحاولة مرة أخرى');
        await fetchRide();
      } else {
        alert(err.response?.data?.message || 'فشل إلغاء الرحلة');
      }
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) return <div className="text-center py-8">جاري التحميل...</div>;
  if (error) return <div className="text-red-600 text-center py-8">{error}</div>;
  if (!ride) return <div className="text-center py-8">لم يتم العثور على الرحلة</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">الرحلة {ride.rideCode}</h1>
        <button
          onClick={() => navigate('/rides')}
          className="text-gray-600 hover:text-gray-900"
        >
          العودة للقائمة
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">التفاصيل</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">تم الإنشاء في {format(new Date(ride.createdAt), 'yyyy/MM/dd HH:mm')}</p>
          </div>
          <div>
            {['SEARCHING', 'DRIVER_ASSIGNED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'].includes(ride.status) && (
              <button
                onClick={handleCancel}
                disabled={cancelLoading}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                إلغاء الرحلة
              </button>
            )}
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">العميل</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {ride.customerName || ride.passenger?.name || 'غير معروف'} 
                <span dir="ltr" className="ml-2">({ride.customerPhone || ride.passenger?.phone})</span>
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">المصدر</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{ride.source}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">الحالة</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{ride.status}</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">الكابتن</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {ride.driver ? (
                  <div>
                    {ride.driver.user.name} <span dir="ltr">({ride.driver.user.phone})</span>
                    {ride.driver.vehicle && (
                      <div className="text-gray-500 mt-1">
                        {ride.driver.vehicle.brand} {ride.driver.vehicle.model} - {ride.driver.vehicle.plateNumber}
                      </div>
                    )}
                  </div>
                ) : 'لم يتم تعيين كابتن'}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50">
              <dt className="text-sm font-medium text-gray-500">نقطة الانطلاق</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {ride.pickupName}
                <div className="text-xs text-gray-400 mt-1" dir="ltr">{ride.pickupLat}, {ride.pickupLng}</div>
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 bg-gray-50">
              <dt className="text-sm font-medium text-gray-500">نقطة الوصول</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {ride.dropoffName}
                <div className="text-xs text-gray-400 mt-1" dir="ltr">{ride.dropoffLat}, {ride.dropoffLng}</div>
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">السعر التقديري</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{ride.estimatedFare} MRU</dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">السعر النهائي</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{ride.finalFare ? `${ride.finalFare} MRU` : 'لم يحدد بعد'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
