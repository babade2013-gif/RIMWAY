import { useEffect, useState } from 'react';
import apiClient from '../../api/client';

interface ServiceType {
  id: string;
  name: string;
  baseFare: number | string;
  perKm: number | string;
  perMinute: number | string;
  minFare: number | string;
  waitingFee: number | string;
  cancelFee: number | string;
  surgeRate: number | string;
  serviceFee: number | string;
  isActive: boolean;
  version: number;
}

export default function PricingList() {
  const [services, setServices] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ServiceType>>({});
  const [saving, setSaving] = useState(false);

  const fetchPricing = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/pricing/service-types');
      setServices(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تحميل إعدادات التسعير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricing();
  }, []);

  const handleStartEdit = (service: ServiceType) => {
    setEditingId(service.id);
    setEditForm({
      baseFare: Number(service.baseFare),
      perKm: Number(service.perKm),
      perMinute: Number(service.perMinute),
      minFare: Number(service.minFare),
      waitingFee: Number(service.waitingFee),
      cancelFee: Number(service.cancelFee),
      serviceFee: Number(service.serviceFee),
      version: service.version,
    });
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    try {
      await apiClient.put(`/admin/pricing/service-types/${id}`, editForm);
      setEditingId(null);
      await fetchPricing();
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert('تعارض في التحديث: تم تعديل بيانات التسعير من قبل مستخدم آخر. يرجى إعادة تحميل الصفحة.');
      } else {
        alert(err.response?.data?.message || 'فشل حفظ التسعير');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إدارة التسعير والعمولات</h1>
          <p className="text-sm text-gray-500 mt-1">
            التحكم في فئات الخدمة، التعرفة الكيلومترية، وعمولة المنصة (Authority: Backend Engine)
          </p>
        </div>
        <button
          onClick={fetchPricing}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
        >
          تحديث
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">جاري تحميل فئات التسعير...</div>
      ) : services.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 border border-gray-100">
          لا توجد خدمات مسجلة
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((service) => {
            const isEditing = editingId === service.id;

            return (
              <div key={service.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{service.name}</h2>
                    <span className="text-xs text-gray-400">الإصدار (Version): {service.version}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      service.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {service.isActive ? 'مفعل' : 'معطل'}
                  </span>
                </div>

                {isEditing ? (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">فتح العداد (Base Fare)</label>
                        <input
                          type="number"
                          value={editForm.baseFare}
                          onChange={(e) => setEditForm({ ...editForm, baseFare: Number(e.target.value) })}
                          className="w-full mt-1 border rounded px-3 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">سعر الكيلومتر (Per KM)</label>
                        <input
                          type="number"
                          value={editForm.perKm}
                          onChange={(e) => setEditForm({ ...editForm, perKm: Number(e.target.value) })}
                          className="w-full mt-1 border rounded px-3 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">سعر الدقيقة (Per Minute)</label>
                        <input
                          type="number"
                          value={editForm.perMinute}
                          onChange={(e) => setEditForm({ ...editForm, perMinute: Number(e.target.value) })}
                          className="w-full mt-1 border rounded px-3 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">الحد الأدنى (Min Fare)</label>
                        <input
                          type="number"
                          value={editForm.minFare}
                          onChange={(e) => setEditForm({ ...editForm, minFare: Number(e.target.value) })}
                          className="w-full mt-1 border rounded px-3 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">رسوم الانتظار (Waiting)</label>
                        <input
                          type="number"
                          value={editForm.waitingFee}
                          onChange={(e) => setEditForm({ ...editForm, waitingFee: Number(e.target.value) })}
                          className="w-full mt-1 border rounded px-3 py-1.5"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">عمولة المنصة % (Commission)</label>
                        <input
                          type="number"
                          value={editForm.serviceFee}
                          onChange={(e) => setEditForm({ ...editForm, serviceFee: Number(e.target.value) })}
                          className="w-full mt-1 border rounded px-3 py-1.5"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 space-x-reverse pt-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={() => handleSave(service.id)}
                        disabled={saving}
                        className="bg-blue-600 text-white px-4 py-1.5 text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-y-2 text-sm text-gray-600">
                    <div>فتح العداد: <span className="font-semibold text-gray-900">{service.baseFare} MRU</span></div>
                    <div>سعر الكيلو: <span className="font-semibold text-gray-900">{service.perKm} MRU</span></div>
                    <div>سعر الدقيقة: <span className="font-semibold text-gray-900">{service.perMinute} MRU</span></div>
                    <div>الحد الأدنى: <span className="font-semibold text-gray-900">{service.minFare} MRU</span></div>
                    <div>رسوم الانتظار: <span className="font-semibold text-gray-900">{service.waitingFee} MRU</span></div>
                    <div>العمولة: <span className="font-semibold text-blue-600">{service.serviceFee}%</span></div>

                    <div className="col-span-2 pt-3 flex justify-end">
                      <button
                        onClick={() => handleStartEdit(service)}
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded text-xs font-medium"
                      >
                        تعديل التسعير
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
