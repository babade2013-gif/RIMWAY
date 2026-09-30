import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { 
  KeyRound, 
  CheckCircle2, 
  ArrowLeft, 
  ShieldCheck, 
  Upload, 
  FileText, 
  Check, 
  HelpCircle,
  AlertCircle
} from 'lucide-react';

export default function CreateCaptain() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);

  // Form data matching 4 steps
  const [formData, setFormData] = useState({
    // Step 1: Personal
    name: '',
    phone: '',
    birthDate: '',
    city: 'نواكشوط',
    email: '',

    // Step 2: National ID
    idFrontName: '',
    idBackName: '',

    // Step 3: Driving License
    licenseNumber: '',
    licenseExpiry: '',
    licenseDocName: '',

    // Step 4: Vehicle
    brand: 'Toyota',
    model: 'Corolla',
    year: 2022,
    color: 'أبيض',
    plateNumber: '',
    serviceTypeId: '',
    vehicleFrontName: '',
    vehicleBackName: '',
    vehicleRightName: '',
    vehicleLeftName: ''
  });

  const stepsList = [
    'البيانات الشخصية',
    'الهوية الوطنية',
    'رخصة القيادة',
    'المركبة'
  ];

  useEffect(() => {
    // Load service types correctly from admin pricing endpoint
    apiClient.get('/admin/pricing/service-types')
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : [];
        setServiceTypes(list);
        if (list.length > 0) {
          setFormData(f => ({ ...f, serviceTypeId: list[0].id }));
        }
      })
      .catch(err => console.error('Failed to load service types:', err));
  }, []);

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!formData.name.trim() || !formData.phone.trim()) {
        setError('يرجى ملء الاسم الكامل ورقم الهاتف للمتابعة.');
        return;
      }
    }
    if (step === 3) {
      if (!formData.licenseNumber.trim()) {
        setError('يرجى إدخال رقم رخصة القيادة.');
        return;
      }
    }
    if (step < 4) {
      setStep(s => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 1) {
      setStep(s => s - 1);
    }
  };

  const handleSubmit = async () => {
    if (!formData.plateNumber.trim()) {
      setError('يرجى إدخال رقم لوحة السيارة.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        vehicle: {
          brand: formData.brand.trim(),
          model: formData.model.trim(),
          year: Number(formData.year) || 2022,
          color: formData.color.trim(),
          plateNumber: formData.plateNumber.trim(),
          serviceTypeId: formData.serviceTypeId || (serviceTypes[0]?.id || '')
        }
      };

      await apiClient.post('/admin/captains', payload);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'فشل في إنشاء حساب الكابتن');
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <section className="onboarding-page" dir="rtl">
        <div className="submission-success">
          <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={36} />
          </div>
          <div className="panel-kicker text-[#1a8b62] justify-center mb-2">
            <ShieldCheck size={14} className="text-[#1a8b62]" />
            تم استلام الطلب
          </div>
          <h2>تم تسجيل الكابتن بنجاح</h2>
          <p>
            تمت إضافة بيانات الكابتن والمركبة إلى النظام بحالة قيد المراجعة. يمكنك الآن مراجعة ملفه وتفعيله من لوحة العمليات.
          </p>
          <div className="border border-amber-200 bg-amber-50/60 rounded-xl p-4 max-w-sm mx-auto mb-6 text-xs flex justify-between items-center">
            <span className="text-gray-500">حالة الكابتن:</span>
            <strong className="text-amber-800 font-bold">قيد المراجعة (PENDING)</strong>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 bg-[#2364d2] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:bg-[#1d58bc] transition-colors"
            onClick={() => navigate('/captains')}
          >
            العودة إلى مركز التحقق
            <ArrowLeft size={14} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="onboarding-page space-y-6" dir="rtl">
      {/* Header */}
      <div className="onboarding-header">
        <div>
          <div className="panel-kicker text-[#2364d2]">
            <KeyRound size={14} className="text-[#2364d2]" />
            بوابة تسجيل الكباتن
          </div>
          <h2>ابدأ رحلتك مع RIM WAY</h2>
          <p>أدخل بيانات الكابتن وبيانات المركبة المطلوبة لتسجيله في الأسطول المعتمد.</p>
        </div>
        <Link
          to="/captains"
          className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-800 bg-white border border-gray-200 px-3.5 py-2 rounded-xl transition-colors shadow-sm"
        >
          العودة للوحة الكباتن
          <ArrowLeft size={14} />
        </Link>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Onboarding Shell with 4 Steps Sidebar */}
      <div className="onboarding-shell">
        {/* Step Sidebar */}
        <aside className="onboarding-steps">
          {stepsList.map((stepName, idx) => {
            const stepNum = idx + 1;
            const isComplete = stepNum < step;
            const isActive = stepNum === step;

            return (
              <button
                key={stepName}
                type="button"
                className={`onboarding-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}`}
                onClick={() => {
                  if (stepNum < step) setStep(stepNum);
                }}
              >
                <span>
                  {isComplete ? <Check size={14} /> : stepNum}
                </span>
                <div>
                  <strong>{stepName}</strong>
                  <small>
                    {isComplete ? 'مكتمل' : isActive ? 'قيد الإدخال' : 'التالي'}
                  </small>
                </div>
              </button>
            );
          })}

          <div className="onboarding-help mt-auto pt-6">
            <HelpCircle size={20} className="text-gray-400" />
            <div>
              <strong>تحتاج مساعدة؟</strong>
              <small>تواصل مع فريق دعم العمليات</small>
            </div>
          </div>
        </aside>

        {/* Step Form Content */}
        <div className="onboarding-form">
          {/* STEP 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="form-title mb-6">
                <span className="form-step-count">01 / 04</span>
                <h3 className="text-lg font-black text-[#20324c] mt-1">البيانات الشخصية</h3>
                <p className="text-xs text-gray-400">أدخل البيانات الأساسية للكابتن لإنشاء ملفه.</p>
              </div>

              <div className="form-grid">
                <label>
                  الاسم الكامل *
                  <input
                    type="text"
                    placeholder="مثال: سيدي محمد ولد علي"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </label>

                <label>
                  رقم الهاتف *
                  <input
                    type="text"
                    placeholder="+222 45 00 00 00"
                    dir="ltr"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </label>

                <label>
                  تاريخ الميلاد
                  <input
                    type="text"
                    placeholder="يوم / شهر / سنة"
                    value={formData.birthDate}
                    onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                  />
                </label>

                <label>
                  المدينة
                  <select
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                  >
                    <option value="نواكشوط">نواكشوط</option>
                    <option value="نواذيبو">نواذيبو</option>
                    <option value="روصو">روصو</option>
                  </select>
                </label>

                <label className="full">
                  البريد الإلكتروني <span>اختياري</span>
                  <input
                    type="email"
                    placeholder="captain@example.com"
                    dir="ltr"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </label>
              </div>
            </div>
          )}

          {/* STEP 2: National ID */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="form-title mb-6">
                <span className="form-step-count">02 / 04</span>
                <h3 className="text-lg font-black text-[#20324c] mt-1">الهوية الوطنية</h3>
                <p className="text-xs text-gray-400">تأكد من إدراج وثائق واضحة ومقروءة للوجهين.</p>
              </div>

              <div className="document-grid">
                <div className="p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 hover:bg-gray-50 flex flex-col items-center justify-center text-center">
                  <FileText size={24} className="text-blue-500 mb-2" />
                  <strong className="text-xs text-gray-700 block mb-1">الهوية الوطنية · الوجه الأمامي</strong>
                  <small className="text-[10px] text-gray-400 block mb-3">JPG أو PNG أو PDF · حتى 10MB</small>
                  <label className="cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                    <Upload size={13} />
                    {formData.idFrontName ? formData.idFrontName : 'تحديد ملف'}
                    <input
                      type="file"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files?.[0]) {
                          setFormData({ ...formData, idFrontName: e.target.files[0].name });
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 hover:bg-gray-50 flex flex-col items-center justify-center text-center">
                  <FileText size={24} className="text-blue-500 mb-2" />
                  <strong className="text-xs text-gray-700 block mb-1">الهوية الوطنية · الوجه الخلفي</strong>
                  <small className="text-[10px] text-gray-400 block mb-3">JPG أو PNG أو PDF · حتى 10MB</small>
                  <label className="cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                    <Upload size={13} />
                    {formData.idBackName ? formData.idBackName : 'تحديد ملف'}
                    <input
                      type="file"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files?.[0]) {
                          setFormData({ ...formData, idBackName: e.target.files[0].name });
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="upload-note">
                <ShieldCheck size={16} />
                <span>تُخزن وثائق الكباتن بشكل مشفر ولا يطلع عليها إلا موظفو المراجعة المصرح لهم.</span>
              </div>
            </div>
          )}

          {/* STEP 3: Driving License */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="form-title mb-6">
                <span className="form-step-count">03 / 04</span>
                <h3 className="text-lg font-black text-[#20324c] mt-1">رخصة القيادة</h3>
                <p className="text-xs text-gray-400">أدخل بيانات رخصة السياقة وحدد ملف الرخصة.</p>
              </div>

              <div className="form-grid">
                <label>
                  رقم رخصة القيادة *
                  <input
                    type="text"
                    placeholder="مثال: DL-99201"
                    value={formData.licenseNumber}
                    onChange={e => setFormData({ ...formData, licenseNumber: e.target.value })}
                  />
                </label>

                <label>
                  تاريخ الانتهاء
                  <input
                    type="text"
                    placeholder="يوم / شهر / سنة"
                    value={formData.licenseExpiry}
                    onChange={e => setFormData({ ...formData, licenseExpiry: e.target.value })}
                  />
                </label>
              </div>

              <div className="document-grid single mt-4">
                <div className="p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50 hover:bg-gray-50 flex flex-col items-center justify-center text-center">
                  <FileText size={24} className="text-blue-500 mb-2" />
                  <strong className="text-xs text-gray-700 block mb-1">صورة رخصة القيادة</strong>
                  <small className="text-[10px] text-gray-400 block mb-3">صورة واضحة للوجه الأمامي</small>
                  <label className="cursor-pointer bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                    <Upload size={13} />
                    {formData.licenseDocName ? formData.licenseDocName : 'تحديد ملف الرخصة'}
                    <input
                      type="file"
                      className="hidden"
                      onChange={e => {
                        if (e.target.files?.[0]) {
                          setFormData({ ...formData, licenseDocName: e.target.files[0].name });
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Vehicle Information */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="form-title mb-6">
                <span className="form-step-count">04 / 04</span>
                <h3 className="text-lg font-black text-[#20324c] mt-1">بيانات وصور المركبة</h3>
                <p className="text-xs text-gray-400">أدخل معلومات السيارة وصورها لربطها بملف الكابتن.</p>
              </div>

              <div className="form-grid">
                <label>
                  ماركة السيارة *
                  <input
                    type="text"
                    placeholder="مثال: Toyota"
                    value={formData.brand}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                  />
                </label>

                <label>
                  موديل السيارة *
                  <input
                    type="text"
                    placeholder="مثال: Corolla"
                    value={formData.model}
                    onChange={e => setFormData({ ...formData, model: e.target.value })}
                  />
                </label>

                <label>
                  سنة الصنع
                  <input
                    type="number"
                    min="1990"
                    max="2035"
                    value={formData.year}
                    onChange={e => setFormData({ ...formData, year: Number(e.target.value) || 2022 })}
                  />
                </label>

                <label>
                  اللون
                  <input
                    type="text"
                    placeholder="مثال: أبيض / رمادي"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                  />
                </label>

                <label className="full">
                  رقم اللوحة *
                  <input
                    type="text"
                    placeholder="مثال: 1234AA00"
                    dir="ltr"
                    value={formData.plateNumber}
                    onChange={e => setFormData({ ...formData, plateNumber: e.target.value })}
                  />
                </label>

                {serviceTypes.length > 0 && (
                  <label className="full">
                    نوع الخدمة / التصنيف
                    <select
                      value={formData.serviceTypeId}
                      onChange={e => setFormData({ ...formData, serviceTypeId: e.target.value })}
                    >
                      {serviceTypes.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.baseFare} MRU أساسي)
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Bottom Step Actions */}
          <div className="flex justify-between items-center pt-8 border-t border-gray-100 mt-8">
            {step > 1 ? (
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                onClick={handleBack}
              >
                السابق
              </button>
            ) : <div />}

            <button
              type="button"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#2364d2] hover:bg-[#1d58bc] shadow-sm transition-all"
              onClick={handleNext}
            >
              {loading
                ? 'جاري الحفظ...'
                : step === 4
                ? 'تأكيد وحفظ الكابتن ↵'
                : 'المتابعة للخطوة التالية ↵'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
