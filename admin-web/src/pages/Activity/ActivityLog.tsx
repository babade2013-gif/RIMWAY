import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { format } from 'date-fns';

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  oldData?: any;
  newData?: any;
  reason?: string;
  ipAddress?: string;
  createdAt: string;
}

export default function ActivityLog() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/admin/audit?skip=${page * limit}&take=${limit}`);
      setLogs(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل تحميل سجل النشاط');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">سجل النشاط والتدقيق الإداري (Audit Log)</h1>
          <p className="text-sm text-gray-500 mt-1">سجل غير قابل للتعديل لكافة الإجراءات الحساسة والتغييرات الإدارية</p>
        </div>
        <button
          onClick={fetchLogs}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium"
        >
          تحديث السجل
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-center">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">جاري تحميل سجل النشاط...</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500">
          لا توجد سجلات مسجلة
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-xl border border-gray-100">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-right">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">الوقت والتاريخ</th>
                  <th className="px-6 py-3">المستخدم / المسؤول</th>
                  <th className="px-6 py-3">نوع الإجراء (Action)</th>
                  <th className="px-6 py-3">العنصر (Entity)</th>
                  <th className="px-6 py-3">السبب / التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm text-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {format(new Date(log.createdAt), 'yyyy/MM/dd HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-gray-600">
                      {log.userId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-blue-50 text-blue-700">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs">
                      <span className="font-semibold">{log.entity}</span>
                      <span className="text-gray-400 font-mono mr-1">({log.entityId.slice(0, 8)}...)</span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      {log.reason ? (
                        <span>السبب: {log.reason}</span>
                      ) : log.newData ? (
                        <span className="font-mono text-gray-400 text-[11px] truncate block max-w-xs">
                          {JSON.stringify(log.newData)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 bg-gray-50 border-t flex justify-between items-center text-sm">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1 bg-white border rounded text-xs disabled:opacity-50"
            >
              الصفحة السابقة
            </button>
            <span className="text-xs text-gray-500">صفحة {page + 1}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < limit}
              className="px-3 py-1 bg-white border rounded text-xs disabled:opacity-50"
            >
              الصفحة التالية
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
