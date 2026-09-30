import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../../api/client';
import { useLanguageStore } from '../../store/languageStore';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  X, 
  FileText, 
  Image, 
  UserCheck
} from 'lucide-react';

export default function CaptainsList() {
  const { t } = useLanguageStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [captains, setCaptains] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  // Selected Captain for Review Modal
  const [selectedCaptain, setSelectedCaptain] = useState<any | null>(null);
  const [captainDetails, setCaptainDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Decision state: 'approve' | 'reupload' | 'reject'
  const [decision, setDecision] = useState<'approve' | 'reupload' | 'reject'>('approve');
  const [rejectReason, setRejectReason] = useState('');
  const [reuploadDocType, setReuploadDocType] = useState('DRIVING_LICENSE');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Zoom Image modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const currentTab = searchParams.get('status') || 'ALL';

  const fetchCaptains = async () => {
    setLoading(true);
    try {
      const params: any = { search, limit: 50 };
      if (currentTab !== 'ALL') {
        params.status = currentTab;
      }
      const { data } = await apiClient.get('/admin/captains', { params });
      const list = Array.isArray(data) ? data : (data.data || []);
      setCaptains(list);

      // Also fetch pending count
      const pendingRes = await apiClient.get('/admin/captains', { params: { status: 'PENDING' } });
      setPendingCount(pendingRes.data?.total || (Array.isArray(pendingRes.data) ? pendingRes.data.length : 0));
    } catch (err: any) {
      setError(t('unknown_error') || 'فشل في جلب بيانات الكباتن');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCaptains();
  }, [currentTab]);

  // When opening a captain file, fetch their full details (including documents & photos)
  const handleOpenReview = async (captain: any) => {
    setSelectedCaptain(captain);
    setDecision(captain.status === 'APPROVED' ? 'approve' : 'approve');
    setRejectReason('');
    setLoadingDetails(true);
    try {
      const { data } = await apiClient.get(`/admin/captains/${captain.id}`);
      setCaptainDetails(data);
    } catch (err) {
      console.error('Failed to fetch captain details:', err);
      setCaptainDetails(captain);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Submit Review Decision
  const handleExecuteDecision = async () => {
    if (!selectedCaptain || isSubmittingDecision) return;
    if (decision !== 'approve' && !rejectReason.trim()) {
      alert('يرجى كتابة سبب الرفض أو الملاحظة للكابتن.');
      return;
    }

    setIsSubmittingDecision(true);
    try {
      if (decision === 'approve') {
        await apiClient.post(`/admin/captains/${selectedCaptain.id}/approve`);
      } else if (decision === 'reupload') {
        const fullReason = `يرجى إعادة رفع [${reuploadDocType}]: ${rejectReason.trim()}`;
        await apiClient.post(`/admin/captains/${selectedCaptain.id}/reject`, { reason: fullReason });
      } else {
        await apiClient.post(`/admin/captains/${selectedCaptain.id}/reject`, { reason: rejectReason.trim() });
      }

      setSelectedCaptain(null);
      setCaptainDetails(null);
      fetchCaptains();
    } catch (err: any) {
      alert(err.response?.data?.message || 'فشل في تحديث حالة الكابتن');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const tabs = [
    { id: 'ALL', label: 'الكل' },
    { id: 'PENDING', label: 'قيد المراجعة', count: pendingCount },
    { id: 'APPROVED', label: 'مقبول' },
    { id: 'REJECTED', label: 'مرفوض' },
    { id: 'SUSPENDED', label: 'موقوف' }
  ];

  const getInitials = (name?: string) => {
    if (!name) return 'كب';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`;
    return parts[0].substring(0, 2);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return { label: 'مقبول', color: 'green', bg: 'bg-[#e5f7ef] text-[#15825a]' };
      case 'PENDING':
        return { label: 'قيد المراجعة', color: 'amber', bg: 'bg-[#fff3df] text-[#b56d08]' };
      case 'REJECTED':
        return { label: 'مرفوض', color: 'red', bg: 'bg-[#fde8e8] text-[#c94949]' };
      case 'SUSPENDED':
        return { label: 'موقوف', color: 'slate', bg: 'bg-[#f0f2f6] text-[#7d8899]' };
      default:
        return { label: status, color: 'slate', bg: 'bg-gray-100 text-gray-700' };
    }
  };

  const approvedCount = captains.filter(c => c.status === 'APPROVED').length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Review Center Header & Summary Banner */}
      <section className="panel review-page bg-white rounded-2xl border border-[#e3e9f2] p-6 shadow-sm">
        <div className="panel-heading flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <div className="panel-kicker text-[#b56d08] flex items-center gap-1.5 text-[11px] font-bold">
              <ShieldCheck size={16} />
              مركز التحقق
            </div>
            <h1 className="text-2xl font-black text-[#20324c] mt-1">طلبات تسجيل الكباتن</h1>
            <p className="mt-1 text-xs text-[#8b98aa]">
              راجع بيانات ووثائق الكباتن وصور مركباتهم قبل تفعيل حساباتهم في شبكة RIM WAY.
            </p>
          </div>

          <Link
            to="/captains/new"
            className="inline-flex items-center gap-2 bg-[#2364d2] hover:bg-[#1d58bc] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <span>＋</span> تسجيل كابتن
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Review Summary KPIs */}
        <div className="review-summary grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="border border-[#edf1f5] rounded-xl p-4 bg-gray-50/50">
            <span className="text-xs text-[#8b98aa] block">طلبات جديدة</span>
            <strong className="text-2xl font-black text-[#253650] block mt-1">{pendingCount}</strong>
            <small className="text-[10px] text-amber-600 block mt-1 font-bold">بانتظار الإجراء والمراجعة</small>
          </div>
          <div className="border border-[#edf1f5] rounded-xl p-4 bg-gray-50/50">
            <span className="text-xs text-[#8b98aa] block">كباتن معتمدون</span>
            <strong className="text-2xl font-black text-[#253650] block mt-1">{approvedCount}</strong>
            <small className="text-[10px] text-green-600 block mt-1 font-bold">حسابات نشطة في الأسطول</small>
          </div>
          <div className="border border-[#edf1f5] rounded-xl p-4 bg-gray-50/50">
            <span className="text-xs text-[#8b98aa] block">متوسط وقت المراجعة</span>
            <strong className="text-2xl font-black text-[#253650] block mt-1">18س</strong>
            <small className="text-[10px] text-blue-600 block mt-1 font-bold">تحسن بنسبة 22% هذا الشهر</small>
          </div>
        </div>

        {/* Review Tabs */}
        <div className="review-tabs flex gap-2 border-b border-gray-100 pb-3 mb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                currentTab === tab.id
                  ? 'bg-[#2364d2] text-white shadow-sm'
                  : 'bg-gray-100/70 text-gray-600 hover:bg-gray-200/60'
              }`}
              onClick={() => {
                if (tab.id === 'ALL') {
                  searchParams.delete('status');
                  setSearchParams(searchParams);
                } else {
                  setSearchParams({ status: tab.id });
                }
              }}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`mr-2 px-1.5 py-0.5 rounded-full text-[10px] ${
                  currentTab === tab.id ? 'bg-white text-blue-600' : 'bg-amber-100 text-amber-800'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <input
            type="text"
            className="w-full max-w-md border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-700 outline-none focus:border-blue-500"
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Review Table */}
        <div className="review-table">
          <div className="review-head grid grid-cols-12 gap-3 pb-3 border-b border-gray-200 text-xs font-bold text-gray-500">
            <span className="col-span-4">الكابتن</span>
            <span className="col-span-2">المركبة</span>
            <span className="col-span-2">الوثائق</span>
            <span className="col-span-2">الحالة</span>
            <span className="col-span-2 text-left">الإجراء</span>
          </div>

          {loading ? (
            <div className="text-center py-10 text-xs text-gray-400">جاري تحميل طلبات الكباتن...</div>
          ) : captains.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <UserCheck size={32} className="mx-auto mb-2 opacity-40" />
              <strong className="block text-sm">لا توجد طلبات كباتن</strong>
              <span className="text-xs">جرّب تغيير التبويب أو كلمة البحث.</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {captains.map((captain) => {
                const badge = getStatusBadge(captain.status);
                const code = `CAP-${captain.id.substring(0, 5).toUpperCase()}`;
                const name = captain.user?.name || 'كابتن بدون اسم';
                const phone = captain.user?.phone || '';
                const vehicleStr = captain.vehicle 
                  ? `${captain.vehicle.brand} ${captain.vehicle.model} (${captain.vehicle.plateNumber})`
                  : 'بدون مركبة';

                return (
                  <div key={captain.id} className="review-row grid grid-cols-12 gap-3 py-3.5 items-center hover:bg-gray-50/70 transition-colors">
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-black text-xs flex items-center justify-center flex-none">
                        {getInitials(name)}
                      </div>
                      <div className="truncate">
                        <strong className="text-xs text-[#20324c] block truncate">{name}</strong>
                        <small className="text-[10px] text-gray-400 block">{code} · {phone}</small>
                      </div>
                    </div>

                    <div className="col-span-2 text-xs text-gray-600 truncate font-semibold">
                      {vehicleStr}
                    </div>

                    <div className="col-span-2">
                      <span className="docs-count inline-flex items-center gap-1.5 text-xs text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded-md">
                        <CheckCircle2 size={13} />
                        مكتملة
                      </span>
                    </div>

                    <div className="col-span-2">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="col-span-2 text-left">
                      <button
                        type="button"
                        className="review-open text-xs font-bold text-[#2364d2] hover:text-[#1d58bc] bg-blue-50/70 hover:bg-blue-100/70 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                        onClick={() => handleOpenReview(captain)}
                      >
                        فتح الملف ↵
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 2. Interactive Decision Modal (Nawil Review Modal) */}
      {selectedCaptain && (
        <div className="review-modal-backdrop fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="review-modal bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="review-modal-head p-5 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
              <div>
                <div className="panel-kicker text-[#2364d2] flex items-center gap-1.5 text-[11px] font-bold mb-1">
                  <ShieldCheck size={15} />
                  مراجعة طلب الكابتن
                </div>
                <h3 className="text-lg font-black text-[#20324c]">
                  {selectedCaptain.user?.name || 'كابتن بدون اسم'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  رقم الكابتن: {selectedCaptain.id} · الهاتف: {selectedCaptain.user?.phone}
                </p>
              </div>
              <button
                type="button"
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setSelectedCaptain(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Document List Review */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-3">الوثائق والصور المرفوعة</h4>
                {loadingDetails ? (
                  <div className="text-center py-4 text-xs text-gray-400">جاري جلب وثائق الكابتن...</div>
                ) : (
                  <div className="review-document-list space-y-2">
                    {captainDetails?.documents && captainDetails.documents.length > 0 ? (
                      captainDetails.documents.map((doc: any) => (
                        <div
                          key={doc.id}
                          className="review-document p-3 bg-gray-50/80 rounded-xl border border-gray-100 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-none">
                              {doc.type.includes('VEHICLE') ? <Image size={16} /> : <FileText size={16} />}
                            </div>
                            <div>
                              <strong className="text-xs text-[#20324c] block">{doc.type}</strong>
                              <small className="text-[10px] text-gray-400 block">{doc.fileName || 'ملف مرفق'}</small>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              مكتمل
                            </span>
                            {doc.documentUrl && (
                              <button
                                type="button"
                                className="text-xs text-blue-600 hover:text-blue-800 font-bold p-1"
                                onClick={() => setPreviewImage(doc.documentUrl)}
                              >
                                معاينة
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
                        لم يتم رفع وثائق لهذا الكابتن حتى الآن.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 3 Decision Options */}
              <div>
                <h4 className="text-xs font-bold text-gray-700 mb-3">حدد القرار الإداري</h4>
                <div className="decision-options grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Approve */}
                  <button
                    type="button"
                    className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      decision === 'approve'
                        ? 'border-[#1a8b62] bg-[#f0faf5] text-[#1a8b62] shadow-sm'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                    }`}
                    onClick={() => setDecision('approve')}
                  >
                    <CheckCircle2 size={20} className={decision === 'approve' ? 'text-[#1a8b62]' : 'text-gray-400'} />
                    <div className="mt-2">
                      <strong className="block text-xs font-bold">قبول الطلب</strong>
                      <small className="text-[10px] text-gray-500 block mt-0.5">تفعيل حساب الكابتن فوراً</small>
                    </div>
                  </button>

                  {/* Reupload */}
                  <button
                    type="button"
                    className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      decision === 'reupload'
                        ? 'border-[#b57b1b] bg-[#fffbf2] text-[#b57b1b] shadow-sm'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                    }`}
                    onClick={() => setDecision('reupload')}
                  >
                    <AlertCircle size={20} className={decision === 'reupload' ? 'text-[#b57b1b]' : 'text-gray-400'} />
                    <div className="mt-2">
                      <strong className="block text-xs font-bold">طلب إعادة رفع</strong>
                      <small className="text-[10px] text-gray-500 block mt-0.5">حدد وثيقة تحتاج صورة أوضح</small>
                    </div>
                  </button>

                  {/* Reject */}
                  <button
                    type="button"
                    className={`p-3.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      decision === 'reject'
                        ? 'border-[#c94949] bg-[#fdf2f2] text-[#c94949] shadow-sm'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                    }`}
                    onClick={() => setDecision('reject')}
                  >
                    <XCircle size={20} className={decision === 'reject' ? 'text-[#c94949]' : 'text-gray-400'} />
                    <div className="mt-2">
                      <strong className="block text-xs font-bold">رفض الطلب</strong>
                      <small className="text-[10px] text-gray-500 block mt-0.5">إغلاق الطلب مع توضيح السبب</small>
                    </div>
                  </button>
                </div>
              </div>

              {/* Conditional Inputs */}
              {decision === 'reupload' && (
                <label className="modal-field block">
                  <span className="text-xs font-bold text-gray-700 block mb-1.5">الوثيقة المطلوبة</span>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs bg-white text-gray-700"
                    value={reuploadDocType}
                    onChange={(e) => setReuploadDocType(e.target.value)}
                  >
                    <option value="NATIONAL_ID">الهوية الوطنية</option>
                    <option value="DRIVING_LICENSE">رخصة القيادة</option>
                    <option value="VEHICLE_INSURANCE">تأمين المركبة</option>
                    <option value="VEHICLE_REGISTRATION">البطاقة الرمادية</option>
                    <option value="VEHICLE_PHOTOS">صور زوايا السيارة</option>
                  </select>
                </label>
              )}

              {decision !== 'approve' && (
                <label className="modal-field block">
                  <span className="text-xs font-bold text-gray-700 block mb-1.5">
                    {decision === 'reject' ? 'سبب الرفض *' : 'ملاحظة للكابتن *'}
                  </span>
                  <textarea
                    rows={3}
                    maxLength={300}
                    className="w-full border border-gray-200 rounded-xl p-3 text-xs text-gray-700 outline-none focus:border-blue-500"
                    placeholder={
                      decision === 'reject'
                        ? 'اكتب سببًا واضحًا يمكن للكابتن فهمه...'
                        : 'مثال: يرجى إعادة رفع صورة رخصة القيادة لأنها غير واضحة.'
                    }
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <small className="text-[10px] text-gray-400 block mt-1">
                    {rejectReason.length} / 300 حرفاً
                  </small>
                </label>
              )}
            </div>

            {/* Modal Footer */}
            <div className="review-modal-footer p-4 border-t border-gray-100 flex justify-end items-center gap-2.5 bg-gray-50/50">
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                onClick={() => setSelectedCaptain(null)}
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={isSubmittingDecision || (decision !== 'approve' && !rejectReason.trim())}
                className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                  decision === 'approve'
                    ? 'bg-[#1a8b62] hover:bg-[#147650]'
                    : decision === 'reupload'
                    ? 'bg-[#b57b1b] hover:bg-[#996814]'
                    : 'bg-[#c94949] hover:bg-[#ad3d3d]'
                } ${isSubmittingDecision || (decision !== 'approve' && !rejectReason.trim()) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleExecuteDecision}
              >
                {isSubmittingDecision
                  ? 'جاري الحفظ...'
                  : decision === 'approve'
                  ? 'تأكيد القبول ↵'
                  : decision === 'reupload'
                  ? 'إرسال طلب إعادة الرفع ↵'
                  : 'تأكيد الرفض ↵'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Image Zoom Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2">
            <button
              type="button"
              className="absolute top-4 left-4 p-2 bg-black/60 text-white rounded-full hover:bg-black"
              onClick={() => setPreviewImage(null)}
            >
              <X size={18} />
            </button>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
}
