import React, { useState, useEffect } from 'react';
import apiClient from '../../api/client';
import { Settings, Save, AlertCircle, Users } from 'lucide-react';

export default function SystemSettings() {
  const [minBalance, setMinBalance] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Stats
  const [totalCaptains, setTotalCaptains] = useState(0);
  const [exhaustedCount, setExhaustedCount] = useState(0);

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await apiClient.get('/admin/system-config');
      setMinBalance(res.data.minWalletBalance.toString());
      setError(null);
    } catch (err: any) {
      setError('فشل في جلب الإعدادات. حاول مجدداً.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      // Re-use dashboard or wallet stats endpoint to see affected captains if possible
      // Assuming /admin/dashboard or /admin/wallet/stats exists based on previous code.
      // We will just try /admin/wallet/stats
      const res = await apiClient.get('/admin/wallet/stats');
      setTotalCaptains(res.data.totalCaptains || 0);
      // exhaustedCaptainsCount in backend is currently hardcoded to <= 0 in that endpoint,
      // but we can just show general stats or wait for backend update.
      setExhaustedCount(res.data.exhaustedCaptainsCount || 0);
    } catch (e) {
      // ignore silently if it fails
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await apiClient.patch('/admin/system-config', {
        minWalletBalance: parseFloat(minBalance),
      });
      setSuccessMsg('تم حفظ الإعدادات بنجاح.');
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchStats(); // refresh stats
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center" dir="rtl">جاري التحميل...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
          <Settings size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">إعدادات النظام</h1>
          <p className="text-sm text-gray-500">تحكم في القواعد العامة لتطبيق RIM WAY</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-r-4 border-red-500 p-4 mb-6 rounded-lg flex items-center gap-3 text-red-700">
          <AlertCircle size={20} />
          <p>{error}</p>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border-r-4 border-green-500 p-4 mb-6 rounded-lg flex items-center gap-3 text-green-700">
          <Save size={20} />
          <p>{successMsg}</p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6 border-b pb-4">إعدادات الكابتن (المحفظة)</h2>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              الحد الأدنى لرصيد المحفظة (لاستقبال الطلبات)
            </label>
            <p className="text-xs text-gray-500 mb-3">
              الكابتن الذي ينخفض رصيده في المحفظة عن هذا الرقم لن يستقبل أي طلبات جديدة حتى يقوم بشحن رصيده.
              <br/> (القيمة الافتراضية: 0)
            </p>
            <div className="flex items-center gap-4 max-w-md">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.01"
                  required
                  value={minBalance}
                  onChange={(e) => setMinBalance(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-left"
                  dir="ltr"
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">MRU</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-all flex items-center gap-2 disabled:opacity-70"
            >
              {saving ? 'جاري الحفظ...' : (
                <>
                  <Save size={20} />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 rounded-2xl border border-blue-100 p-6 flex items-start gap-4">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
          <Users size={24} />
        </div>
        <div>
          <h3 className="font-bold text-blue-900 mb-1">ملاحظة حول الكباتن المتأثرين</h3>
          <p className="text-sm text-blue-700 leading-relaxed">
            عند تغيير هذه القيمة، سيتم تطبيقها فوراً على محرك توزيع الطلبات (Dispatch Engine).
            أي كابتن متصل حالياً ورصيده أقل من {minBalance || '0'} MRU سيتم تخطيه تلقائياً ولن تصله الطلبات.
          </p>
        </div>
      </div>
    </div>
  );
}
