import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useLanguageStore } from '../../store/languageStore';
import { CheckCircle, XCircle, AlertTriangle, ExternalLink, X, ZoomIn } from 'lucide-react';

export default function CaptainDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguageStore();

  const [captain, setCaptain] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'review_docs' | 'wallet' | 'complaints'>('info');

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  // Image zoom modal
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  // Wallet State & Modals
  const [transactions, setTransactions] = useState<any[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showDebitModal, setShowDebitModal] = useState(false);
  const [modalAmount, setModalAmount] = useState('');
  const [modalReason, setModalReason] = useState('');
  const [modalError, setModalError] = useState('');

  const fetchCaptain = async () => {
    try {
      const capRes = await apiClient.get(`/admin/captains/${id}`);
      setCaptain(capRes.data);
      let allDocs = capRes.data?.documents || [];
      try {
        const docRes = await apiClient.get(`/admin/documents/drivers/${id}`);
        if (docRes.data && Array.isArray(docRes.data) && docRes.data.length > 0) {
          allDocs = docRes.data;
        }
      } catch (docErr) {
        console.warn('Could not fetch extra documents, using captain documents', docErr);
      }
      setDocuments(allDocs);
    } catch (err) {
      console.error('Failed to load captain details:', err);
      setError('فشل في جلب بيانات الكابتن');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptain();
  }, [id]);

  const handleApprove = async () => {
    if (!window.confirm('هل أنت متأكد من اعتماد هذا الكابتن وتفعيل حسابه؟')) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/admin/captains/${id}/approve`, { reason: 'Admin approval via web review' });
      await fetchCaptain();
      alert('تم اعتماد الكابتن بنجاح');
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل الاعتماد');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError(t('reject_reason_required'));
      return;
    }
    setActionLoading(true);
    setRejectError('');
    try {
      await apiClient.post(`/admin/captains/${id}/reject`, { reason: rejectReason.trim() });
      setShowRejectModal(false);
      setRejectReason('');
      await fetchCaptain();
      alert('تم رفض الطلب بنجاح وتم تسجيل السبب');
    } catch (err: any) {
      setRejectError(err.response?.data?.message || 'فشل إجراء الرفض');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    const reason = window.prompt('يرجى كتابة سبب تعليق الكابتن:', 'إجراء إداري');
    if (reason === null) return;
    setActionLoading(true);
    try {
      await apiClient.post(`/admin/captains/${id}/suspend`, { reason });
      await fetchCaptain();
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل التعليق');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionLoading(true);
    try {
      await apiClient.post(`/admin/captains/${id}/reactivate`, { reason: 'Reactivated by admin' });
      await fetchCaptain();
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل إعادة التفعيل');
    } finally {
      setActionLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setTransactionsLoading(true);
      const res = await apiClient.get(`/admin/captains/${id}/wallet/transactions`);
      setTransactions(res.data?.data || res.data?.transactions || []);
    } catch (err) {
      console.error('Failed to load wallet transactions', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'wallet') {
      fetchTransactions();
    }
  }, [activeTab, id]);

  const handleManualCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    const amt = Number(modalAmount);
    if (!amt || amt <= 0) {
      setModalError('يرجى إدخال مبلغ صحيح أكبر من 0');
      return;
    }
    if (!modalReason.trim()) {
      setModalError('السبب إلزامي لتسجيل العملية في سجل التدقيق');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.post('/admin/wallet/manual-credit', {
        driverId: id,
        amount: amt,
        reason: modalReason.trim(),
      });
      setShowCreditModal(false);
      setModalAmount('');
      setModalReason('');
      await fetchCaptain();
      await fetchTransactions();
      alert('تم شحن الرصيد بنجاح');
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'فشل شحن الرصيد');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualDebit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    const amt = Number(modalAmount);
    if (!amt || amt <= 0) {
      setModalError('يرجى إدخال مبلغ صحيح أكبر من 0');
      return;
    }
    if (!modalReason.trim()) {
      setModalError('السبب إلزامي لتسجيل العملية في سجل التدقيق');
      return;
    }
    setActionLoading(true);
    try {
      await apiClient.post('/admin/wallet/manual-debit', {
        driverId: id,
        amount: amt,
        reason: modalReason.trim(),
      });
      setShowDebitModal(false);
      setModalAmount('');
      setModalReason('');
      await fetchCaptain();
      await fetchTransactions();
      alert('تم خصم الرصيد بنجاح');
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'فشل خصم الرصيد');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">{t('loading')}</div>;
  if (error) return <div className="text-red-600 text-center py-8">{error}</div>;
  if (!captain) return <div className="text-center py-8">لم يتم العثور على الكابتن</div>;

  // Filter 4 documents and 4 vehicle photos
  const driverDocs = documents.filter((d: any) => !d.type.startsWith('VEHICLE_'));
  const vehiclePhotos = documents.filter((d: any) => d.type.startsWith('VEHICLE_'));

  const getFullFileUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const base = apiClient.defaults.baseURL?.replace('/api/v1', '') || 'http://localhost:3000';
    return `${base}${url}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('captain_profile')}: {captain.user?.name || 'بدون اسم'}
          </h1>
          <p className="text-sm text-gray-500 mt-1" dir="ltr">{captain.user?.phone}</p>
        </div>
        <button
          onClick={() => navigate('/captains')}
          className="text-gray-600 hover:text-gray-900 border px-3 py-1.5 rounded-lg text-sm bg-white"
        >
          {t('back_to_list')}
        </button>
      </div>

      {/* Decision Banner if PENDING */}
      {captain.status === 'PENDING' && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-amber-900">{t('review_request_title')}</h3>
              </div>
              <p className="text-sm text-amber-700 mt-1">
                الكابتن بانتظار قرار الإدارة للاعتماد أو الرفض مع سبب محدد.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2 rounded-lg text-sm shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                {t('approve_captain_btn')}
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-lg text-sm shadow-sm flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" />
                {t('reject_request_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Notice if REJECTED */}
      {captain.status === 'REJECTED' && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-5 shadow-sm">
          <h3 className="text-base font-bold text-red-900 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            {t('rejection_reason_title')}
          </h3>
          <p className="text-sm text-red-800 mt-2 font-medium bg-white p-3 rounded-lg border border-red-200">
            {captain.rejectionReason || 'لم يتم تسجيل سبب محدد'}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 space-x-reverse text-sm font-medium">
          <button
            onClick={() => setActiveTab('info')}
            className={`pb-3 px-1 border-b-2 ${
              activeTab === 'info' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tab_info')}
          </button>
          <button
            onClick={() => setActiveTab('review_docs')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 ${
              activeTab === 'review_docs' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tab_review_docs')}
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">
              {documents.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('wallet')}
            className={`pb-3 px-1 border-b-2 flex items-center gap-2 ${
              activeTab === 'wallet' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('tab_wallet')}
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              Number(captain.walletBalance || 0) > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {Number(captain.walletBalance || 0).toLocaleString()} MRU
            </span>
          </button>
        </nav>
      </div>

      {/* Tab: Info */}
      {activeTab === 'info' && (
        <div className="space-y-6">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">{t('operational_info')}</h3>
              <div className="flex gap-2">
                {captain.status === 'APPROVED' && (
                  <button
                    onClick={handleSuspend}
                    disabled={actionLoading}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm font-bold"
                  >
                    {t('suspend_captain_btn')}
                  </button>
                )}
                {captain.status === 'SUSPENDED' && (
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-bold"
                  >
                    {t('reactivate_captain_btn')}
                  </button>
                )}
              </div>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500">{t('col_status')}:</span>
                <p className="text-sm font-bold text-gray-900">{t('status_' + captain.status) || captain.status}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">{t('col_online')}:</span>
                <p className="text-sm font-bold text-gray-900">{captain.isOnline ? t('online') : t('offline')}</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">{t('wallet_balance')}:</span>
                <p className="text-sm font-bold text-gray-900">{captain.walletBalance} MRU</p>
              </div>
              <div>
                <span className="text-xs text-gray-500">{t('col_rating')}:</span>
                <p className="text-sm font-bold text-gray-900">⭐ {captain.rating} / 5.00</p>
              </div>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg font-bold text-gray-900">{t('vehicle_info')}</h3>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:p-6">
              {captain.vehicle ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs text-gray-500">{t('brand')}:</span>
                    <p className="text-sm font-bold text-gray-900">{captain.vehicle.brand}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">{t('model')}:</span>
                    <p className="text-sm font-bold text-gray-900">{captain.vehicle.model}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">{t('year')}:</span>
                    <p className="text-sm font-bold text-gray-900">{captain.vehicle.year}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">{t('color')}:</span>
                    <p className="text-sm font-bold text-gray-900">{captain.vehicle.color}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500">{t('plate_number')}:</span>
                    <p className="text-sm font-bold text-gray-900">{captain.vehicle.plateNumber}</p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">{t('no_vehicle')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Documents & Vehicle Photos Review */}
      {activeTab === 'review_docs' && (
        <div className="space-y-8">
          {/* Section 1: 4 Driver Documents */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('section_driver_docs')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {['NATIONAL_ID', 'DRIVING_LICENSE', 'VEHICLE_INSURANCE', 'VEHICLE_REGISTRATION'].map((docType) => {
                const doc = driverDocs.find((d: any) => d.type === docType);
                const title = t('doc_' + docType);
                return (
                  <div key={docType} className="border rounded-xl p-4 flex flex-col justify-between bg-gray-50">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-gray-700">{title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          doc ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {doc ? 'مرفوع ✓' : 'مفقود ✕'}
                        </span>
                      </div>
                      {doc ? (
                        <div
                          className="mt-3 h-36 bg-gray-200 rounded-lg overflow-hidden relative group cursor-pointer border"
                          onClick={() => setZoomImage({ url: getFullFileUrl(doc.fileUrl), title })}
                        >
                          <img
                            src={getFullFileUrl(doc.fileUrl)}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                            <ZoomIn className="w-5 h-5 ml-1" />
                            {t('click_to_zoom')}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 h-36 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-xs text-center p-2">
                          لم يتم رفع هذه الوثيقة بعد
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: 4 Vehicle Photos */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">{t('section_vehicle_photos')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {['VEHICLE_FRONT', 'VEHICLE_BACK', 'VEHICLE_RIGHT', 'VEHICLE_LEFT'].map((photoType) => {
                const photo = vehiclePhotos.find((p: any) => p.type === photoType);
                const title = t('photo_' + photoType);
                return (
                  <div key={photoType} className="border rounded-xl p-4 flex flex-col justify-between bg-gray-50">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-gray-700">{title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          photo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {photo ? 'مرفوع ✓' : 'مفقود ✕'}
                        </span>
                      </div>
                      {photo ? (
                        <div
                          className="mt-3 h-36 bg-gray-200 rounded-lg overflow-hidden relative group cursor-pointer border"
                          onClick={() => setZoomImage({ url: getFullFileUrl(photo.fileUrl), title })}
                        >
                          <img
                            src={getFullFileUrl(photo.fileUrl)}
                            alt={title}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition">
                            <ZoomIn className="w-5 h-5 ml-1" />
                            {t('click_to_zoom')}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 h-36 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 text-xs text-center p-2">
                          لم يتم رفع الصورة بعد
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Wallet */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
          {/* Wallet Balance Card */}
          <div className="bg-white shadow rounded-xl p-6 border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">الرصيد التشغيلي الحالي للكابتن</span>
                <div className="mt-2 flex items-baseline">
                  <span className={`text-4xl font-extrabold ${
                    Number(captain.walletBalance || 0) > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {Number(captain.walletBalance || 0).toLocaleString()}
                  </span>
                  <span className="mr-2 text-base text-gray-500 font-bold">MRU</span>
                </div>
                <div className="mt-2">
                  {Number(captain.walletBalance || 0) > 0 ? (
                    <span className="inline-flex items-center text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full border border-green-200">
                      ✓ رصيد مفعّل - الكابتن مؤهل لاستقبال الرحلات
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                      ⚠ الرصيد نافد (0 أو أقل) - الكابتن محظور تلقائياً من استقبال الرحلات حتى الشحن
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setModalError('');
                    setModalAmount('');
                    setModalReason('');
                    setShowCreditModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm flex items-center gap-1.5"
                >
                  + شحن رصيد يدوي
                </button>
                <button
                  onClick={() => {
                    setModalError('');
                    setModalAmount('');
                    setModalReason('');
                    setShowDebitModal(true);
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-sm flex items-center gap-1.5"
                >
                  - خصم رصيد يدوي
                </button>
              </div>
            </div>
          </div>

          {/* Transactions Ledger */}
          <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-base font-bold text-gray-900">سجل حركات المحفظة التشغيلية</h3>
              <button
                onClick={fetchTransactions}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                تحديث السجل
              </button>
            </div>

            {transactionsLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">جاري تحميل حركات المحفظة...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">لا توجد حركات مالية مسجلة لهذا الكابتن</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-right text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold">
                    <tr>
                      <th className="px-4 py-3">التاريخ / الوقت</th>
                      <th className="px-4 py-3">نوع الحركة</th>
                      <th className="px-4 py-3">المبلغ</th>
                      <th className="px-4 py-3">الرصيد قبل</th>
                      <th className="px-4 py-3">الرصيد بعد</th>
                      <th className="px-4 py-3">البيان / السبب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {transactions.map((tx: any) => {
                      const isCredit = ['TOP_UP', 'MANUAL_CREDIT'].includes(tx.type);
                      return (
                        <tr key={tx.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                            {new Date(tx.createdAt).toLocaleString('ar-MR')}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              tx.type === 'COMMISSION' ? 'bg-orange-100 text-orange-800' :
                              tx.type === 'TOP_UP' ? 'bg-green-100 text-green-800' :
                              tx.type === 'MANUAL_CREDIT' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {tx.type === 'COMMISSION' ? 'خصم عمولة' :
                               tx.type === 'TOP_UP' ? 'شحن رصيد' :
                               tx.type === 'MANUAL_CREDIT' ? 'إيداع إداري' :
                               tx.type === 'MANUAL_DEBIT' ? 'خصم إداري' : tx.type}
                            </span>
                          </td>
                          <td className={`px-4 py-3 font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {isCredit ? '+' : '-'}{Number(tx.amount).toLocaleString()} MRU
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {tx.balanceBefore != null ? `${Number(tx.balanceBefore).toLocaleString()} MRU` : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-900 font-bold">
                            {tx.balanceAfter != null ? `${Number(tx.balanceAfter).toLocaleString()} MRU` : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {tx.description || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Credit Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-emerald-700">+ شحن رصيد تشغيلي يدوي للكابتن</h3>
              <button onClick={() => setShowCreditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              سيتم إضافة المبلغ مباشرة إلى المحفظة التشغيلية للكابتن وتوثيق العملية في سجل التدقيق.
            </p>

            {modalError && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleManualCredit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">المبلغ (MRU) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  placeholder="مثال: 500"
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">السبب / المرجع الإداري *</label>
                <input
                  type="text"
                  required
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="مثال: تحويل بنكي بنكيلي رقم #12345"
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreditModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
                >
                  {actionLoading ? t('loading') : 'تأكيد الشحن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Debit Modal */}
      {showDebitModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-rose-700">- خصم يدوي من رصيد الكابتن</h3>
              <button onClick={() => setShowDebitModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500">
              سيتم خصم المبلغ من المحفظة التشغيلية للكابتن وتوثيق العملية في سجل التدقيق.
            </p>

            {modalError && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleManualDebit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">المبلغ المراد خصمه (MRU) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={modalAmount}
                  onChange={(e) => setModalAmount(e.target.value)}
                  placeholder="مثال: 100"
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">سبب الخصم الإداري *</label>
                <input
                  type="text"
                  required
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="مثال: تسوية خطأ تقييد أو مخالفة معتمدة"
                  className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDebitModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
                >
                  {actionLoading ? t('loading') : 'تأكيد الخصم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-red-600">{t('reject_modal_title')}</h3>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">{t('reject_modal_desc')}</p>

            {rejectError && (
              <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
                {rejectError}
              </div>
            )}

            <form onSubmit={handleReject} className="space-y-4">
              <textarea
                rows={4}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t('reject_reason_placeholder')}
                className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  {actionLoading ? t('loading') : t('confirm_reject')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Inspection Zoom Modal */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomImage(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h4 className="font-bold text-sm text-gray-800">{zoomImage.title}</h4>
              <div className="flex items-center gap-2">
                <a
                  href={zoomImage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:text-blue-800 text-xs flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  فتح في تبويب جديد
                </a>
                <button onClick={() => setZoomImage(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[80vh] overflow-auto bg-gray-100">
              <img src={zoomImage.url} alt={zoomImage.title} className="max-w-full max-h-full object-contain rounded" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
