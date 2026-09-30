import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { format } from 'date-fns';

interface Complaint {
  id: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  reporter?: {
    name?: string;
    phone?: string;
  };
  ride?: {
    id: string;
    rideCode: string;
  };
}

export default function ComplaintsList() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchComplaints = async () => {
    setLoading(true);
    try {
      const url = statusFilter ? `/admin/complaints?status=${statusFilter}` : '/admin/complaints';
      const res = await apiClient.get(url);
      setComplaints(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تحميل الشكاوى');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      await apiClient.put(`/admin/complaints/${id}/status`, { status: newStatus });
      await fetchComplaints();
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل تحديث حالة الشكوى');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">إدارة الشكاوى والملاحظات</h1>
        <div className="flex items-center space-x-3 space-x-reverse">
          <label className="text-sm font-medium text-gray-700">تصفية حسب الحالة:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
          >
            <option value="">جميع الحالات</option>
            <option value="OPEN">مفتوحة (OPEN)</option>
            <option value="IN_PROGRESS">قيد المتابعة (IN_PROGRESS)</option>
            <option value="RESOLVED">تم الحل (RESOLVED)</option>
            <option value="REJECTED">مرفوضة (REJECTED)</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">جاري تحميل الشكاوى...</div>
      ) : complaints.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
          لا توجد شكاوى مسجلة
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-100">
          <ul className="divide-y divide-gray-200">
            {complaints.map((c) => (
              <li key={c.id} className="p-6 hover:bg-gray-50 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{c.subject}</h3>
                    <p className="text-sm text-gray-600 mt-1">{c.description}</p>
                    <div className="mt-3 flex items-center space-x-4 space-x-reverse text-xs text-gray-500">
                      <span>المرسل: {c.reporter?.name || c.reporter?.phone || 'مجهول'}</span>
                      {c.ride && <span>رمز الرحلة: {c.ride.rideCode}</span>}
                      <span>
                        {format(new Date(c.createdAt), 'yyyy/MM/dd HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        c.status === 'OPEN'
                          ? 'bg-yellow-100 text-yellow-800'
                          : c.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : c.status === 'RESOLVED'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {c.status}
                    </span>

                    <div className="flex items-center space-x-2 space-x-reverse">
                      {c.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleUpdateStatus(c.id, 'RESOLVED')}
                          disabled={actionLoading === c.id}
                          className="bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
                        >
                          إغلاق كـ محلولة
                        </button>
                      )}
                      {c.status !== 'REJECTED' && (
                        <button
                          onClick={() => handleUpdateStatus(c.id, 'REJECTED')}
                          disabled={actionLoading === c.id}
                          className="bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1 rounded text-xs font-medium disabled:opacity-50"
                        >
                          رفض
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
