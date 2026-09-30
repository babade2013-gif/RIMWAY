import { create } from 'zustand';

export type Language = 'ar' | 'fr';

const translations: Record<Language, Record<string, string>> = {
  ar: {
    // Navigation
    nav_dashboard: 'الرئيسية',
    nav_rides: 'الرحلات',
    nav_captains: 'إدارة الكباتن',
    nav_wallets: 'إدارة الشحن والمحافظ',
    nav_registration_requests: 'طلبات تسجيل الكباتن',
    nav_pricing: 'التسعير',
    nav_complaints: 'الشكاوى',
    nav_activity: 'السجل الإداري',
    logout: 'تسجيل الخروج',

    // Captains List
    captains_management: 'إدارة الكباتن',
    add_captain: 'إضافة كابتن يدوياً',
    search_placeholder: 'بحث بالاسم أو رقم الهاتف...',
    search_btn: 'بحث',
    tab_all: 'جميع الكباتن',
    tab_pending: 'طلبات التسجيل (قيد المراجعة)',
    tab_approved: 'الكباتن المعتمدون',
    tab_rejected: 'المرفوضون',
    tab_suspended: 'الموقوفون',
    col_name_phone: 'الاسم / الهاتف',
    col_status: 'الحالة',
    col_online: 'الاتصال',
    col_rating: 'التقييم',
    col_vehicle: 'المركبة',
    col_actions: 'الإجراءات',
    view_details: 'عرض ومراجعة',
    online: 'متصل',
    offline: 'غير متصل',
    no_captains: 'لا يوجد كباتن في هذه الفئة',
    loading: 'جاري التحميل...',

    // Statuses
    status_PENDING: 'قيد المراجعة',
    status_APPROVED: 'معتمد',
    status_REJECTED: 'مرفوض',
    status_SUSPENDED: 'موقوف',

    // Captain Details & Review
    captain_profile: 'ملف الكابتن',
    back_to_list: 'العودة للقائمة',
    tab_info: 'المعلومات والمركبة',
    tab_review_docs: 'فحص الوثائق وصور المركبة',
    tab_ratings: 'سجل التقييمات',
    tab_wallet: 'المحفظة المالية',
    tab_complaints: 'الشكاوى',
    operational_info: 'المعلومات التشغيلية',
    priority_tier: 'مستوى الأولوية',
    wallet_balance: 'رصيد المحفظة',
    total_trips: 'إجمالي الرحلات',
    vehicle_info: 'بيانات المركبة',
    brand: 'الماركة',
    model: 'الموديل',
    year: 'سنة الصنع',
    color: 'اللون',
    plate_number: 'رقم اللوحة',
    service_type: 'نوع الخدمة',
    no_vehicle: 'لا توجد مركبة مسجلة',

    // Review Actions
    review_request_title: 'مراجعة وتدقيق طلب تسجيل الكابتن',
    approve_captain_btn: 'اعتماد الكابتن',
    reject_request_btn: 'رفض الطلب',
    suspend_captain_btn: 'تعليق الحساب',
    reactivate_captain_btn: 'إعادة التفعيل',
    rejection_reason_title: 'سبب الرفض المسجل',

    // Modal Reject
    reject_modal_title: 'رفض طلب تسجيل الكابتن',
    reject_modal_desc: 'يرجى كتابة سبب الرفض بدقة ليظهر للكابتن في تطبيقه ليتمكن من تصحيحه:',
    reject_reason_placeholder: 'مثال: صورة رخصة السياقة غير واضحة / صورة السيارة الخلفية غير مطابقة',
    confirm_reject: 'تأكيد الرفض',
    cancel: 'إلغاء',
    reject_reason_required: 'سبب الرفض إلزامي ولا يمكن تركه فارغاً',

    // Documents & Photos Inspection
    section_driver_docs: 'وثائق الكابتن الرسمية (4 وثائق)',
    section_vehicle_photos: 'صور المركبة الأربع المطلوبة (4 زوايا)',
    doc_NATIONAL_ID: 'بطاقة التعريف الوطنية',
    doc_DRIVING_LICENSE: 'رخصة السياقة',
    doc_VEHICLE_INSURANCE: 'وثيقة التأمين',
    doc_VEHICLE_REGISTRATION: 'البطاقة الرمادية (Carte Grise)',
    photo_VEHICLE_FRONT: 'صورة السيارة من الأمام',
    photo_VEHICLE_BACK: 'صورة السيارة من الخلف',
    photo_VEHICLE_RIGHT: 'صورة السيارة من اليمين',
    photo_VEHICLE_LEFT: 'صورة السيارة من اليسار',
    click_to_zoom: 'انقر للتكبير والمعاينة',
    close: 'إغلاق',

    // Create Captain Manual
    create_captain_title: 'إضافة كابتن جديد (يدوي)',
    manual_notice: 'ملاحظة: الإضافة اليدوية تنشئ الطلب بحالة "قيد المراجعة" للمطابقة والتدقيق الإداري.',
    phone_label: 'رقم الهاتف *',
    name_label: 'الاسم الكامل *',
    include_vehicle: 'إضافة بيانات المركبة والوثائق',
    create_submit_btn: 'حفظ طلب الكابتن',
  },
  fr: {
    // Navigation
    nav_dashboard: 'Tableau de bord',
    nav_rides: 'Courses',
    nav_captains: 'Chauffeurs',
    nav_wallets: 'Portefeuilles & Recharges',
    nav_registration_requests: 'Demandes d\'inscription',
    nav_pricing: 'Tarification',
    nav_complaints: 'Réclamations',
    nav_activity: 'Journal d\'activité',
    logout: 'Déconnexion',

    // Captains List
    captains_management: 'Gestion des Chauffeurs',
    add_captain: 'Ajouter un chauffeur manuellement',
    search_placeholder: 'Rechercher par nom ou téléphone...',
    search_btn: 'Rechercher',
    tab_all: 'Tous les chauffeurs',
    tab_pending: 'Demandes en attente',
    tab_approved: 'Chauffeurs approuvés',
    tab_rejected: 'Refusés',
    tab_suspended: 'Suspendus',
    col_name_phone: 'Nom / Téléphone',
    col_status: 'Statut',
    col_online: 'Connexion',
    col_rating: 'Note',
    col_vehicle: 'Véhicule',
    col_actions: 'Actions',
    view_details: 'Voir & Examiner',
    online: 'En ligne',
    offline: 'Hors ligne',
    no_captains: 'Aucun chauffeur dans cette catégorie',
    loading: 'Chargement en cours...',

    // Statuses
    status_PENDING: 'En attente',
    status_APPROVED: 'Approuvé',
    status_REJECTED: 'Refusé',
    status_SUSPENDED: 'Suspendu',

    // Captain Details & Review
    captain_profile: 'Profil du Chauffeur',
    back_to_list: 'Retour à la liste',
    tab_info: 'Informations & Véhicule',
    tab_review_docs: 'Documents & Photos du véhicule',
    tab_ratings: 'Évaluations',
    tab_wallet: 'Portefeuille financier',
    tab_complaints: 'Réclamations',
    operational_info: 'Informations opérationnelles',
    priority_tier: 'Niveau de priorité',
    wallet_balance: 'Solde du portefeuille',
    total_trips: 'Courses totales',
    vehicle_info: 'Informations sur le véhicule',
    brand: 'Marque',
    model: 'Modèle',
    year: 'Année',
    color: 'Couleur',
    plate_number: 'Immatriculation',
    service_type: 'Type de service',
    no_vehicle: 'Aucun véhicule enregistré',

    // Review Actions
    review_request_title: 'Examen de la demande d\'inscription',
    approve_captain_btn: 'Approuver le chauffeur',
    reject_request_btn: 'Rejeter la demande',
    suspend_captain_btn: 'Suspendre le compte',
    reactivate_captain_btn: 'Réactiver le compte',
    rejection_reason_title: 'Motif du refus enregistré',

    // Modal Reject
    reject_modal_title: 'Rejeter la demande d\'inscription',
    reject_modal_desc: 'Veuillez préciser le motif exact du refus pour que le chauffeur puisse le corriger dans son application :',
    reject_reason_placeholder: 'Ex: Permis de conduire illisible / Photo arrière non conforme',
    confirm_reject: 'Confirmer le rejet',
    cancel: 'Annuler',
    reject_reason_required: 'Le motif de refus est obligatoire',

    // Documents & Photos Inspection
    section_driver_docs: 'Documents officiels du chauffeur (4 requis)',
    section_vehicle_photos: 'Photos du véhicule sous 4 angles (4 requises)',
    doc_NATIONAL_ID: 'Carte Nationale d\'Identité',
    doc_DRIVING_LICENSE: 'Permis de conduire',
    doc_VEHICLE_INSURANCE: 'Attestation d\'assurance',
    doc_VEHICLE_REGISTRATION: 'Carte Grise',
    photo_VEHICLE_FRONT: 'Photo du véhicule de face',
    photo_VEHICLE_BACK: 'Photo du véhicule de dos',
    photo_VEHICLE_RIGHT: 'Photo du véhicule côté droit',
    photo_VEHICLE_LEFT: 'Photo du véhicule côté gauche',
    click_to_zoom: 'Cliquer pour agrandir',
    close: 'Fermer',

    // Create Captain Manual
    create_captain_title: 'Ajouter un nouveau chauffeur (Manuel)',
    manual_notice: 'Remarque : L\'ajout manuel crée la demande avec le statut "En attente" pour vérification administrative.',
    phone_label: 'Numéro de téléphone *',
    name_label: 'Nom complet *',
    include_vehicle: 'Inclure le véhicule et les documents',
    create_submit_btn: 'Enregistrer la demande',
  },
};

interface LanguageStore {
  language: Language;
  dir: 'rtl' | 'ltr';
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem('admin_language') as Language;
  if (saved === 'ar' || saved === 'fr') return saved;
  return 'ar';
};

export const useLanguageStore = create<LanguageStore>((set, get) => ({
  language: getInitialLanguage(),
  dir: getInitialLanguage() === 'ar' ? 'rtl' : 'ltr',
  setLanguage: (lang: Language) => {
    localStorage.setItem('admin_language', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    set({
      language: lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
    });
  },
  t: (key: string) => {
    const lang = get().language;
    return translations[lang]?.[key] || translations['ar']?.[key] || key;
  },
}));
