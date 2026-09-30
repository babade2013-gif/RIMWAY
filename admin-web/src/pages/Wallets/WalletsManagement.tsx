import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useLanguageStore } from '../../store/languageStore';
import { 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  DollarSign, 
  RefreshCw, 
  Search, 
  TrendingUp, 
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  X
} from 'lucide-react';

interface TopUpRequest {
  id: string;
  driverId: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reference?: string;
  notes?: string;
  rejectionReason?: string;
  createdAt: string;
  processedAt?: string;
  driver?: {
    id: string;
    user?: {
      name?: string;
      phone: string;
    };
    vehicle?: {
      brand?: string;
      model?: string;
      plateNumber?: string;
    };
  };
}

interface CaptainWallet {
  id: string;
  name: string;
  phone: string;
  walletBalance: number;
  status: string;
  isOnline: boolean;
  vehicle?: {
    brand?: string;
    model?: string;
    plateNumber?: string;
  };
}

interface FinancialStats {
  totalTripValue: number;
  totalCommission: number;
  totalCaptainWallets: number;
  exhaustedCaptainsCount: number;
  pendingTopUpsCount: number;
}

export default function WalletsManagement() {
  const { language } = useLanguageStore();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'topups' | 'wallets'>('topups');
  const [topUpFilter, setTopUpFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING');

  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [topUps, setTopUps] = useState<TopUpRequest[]>([]);
  const [captains, setCaptains] = useState<CaptainWallet[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [selectedTopUp, setSelectedTopUp] = useState<TopUpRequest | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Manual Credit / Debit modal state
  const [manualModalCaptain, setManualModalCaptain] = useState<CaptainWallet | null>(null);
  const [manualModalType, setManualModalType] = useState<'credit' | 'debit'>('credit');
  const [manualAmount, setManualAmount] = useState('');
  const [manualReason, setManualReason] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Stats
      const statsRes = await apiClient.get('/admin/wallet/stats');
      setStats(statsRes.data);

      // 2. Fetch Top-Up Requests
      const topUpParams = topUpFilter !== 'ALL' ? { status: topUpFilter } : {};
      const topUpsRes = await apiClient.get('/admin/wallet/top-ups', { params: topUpParams });
      setTopUps(Array.isArray(topUpsRes.data) ? topUpsRes.data : []);

      // 3. Fetch Captains
      const captainsRes = await apiClient.get('/admin/captains', { params: { limit: 100 } });
      const capList = Array.isArray(captainsRes.data) ? captainsRes.data : (captainsRes.data?.data || []);
      const mappedCaptains: CaptainWallet[] = capList.map((c: any) => ({
        id: c.id,
        name: c.name || c.user?.name || (isAr ? 'كابتن بدون اسم' : 'Chauffeur sans nom'),
        phone: c.phone || c.user?.phone || '',
        walletBalance: Number(c.walletBalance ?? 0),
        status: c.status,
        isOnline: !!c.isOnline,
        vehicle: c.vehicle,
      }));
      setCaptains(mappedCaptains);
    } catch (err: any) {
      setError(err.response?.data?.message || (isAr ? 'فشل تحميل بيانات المحافظ' : 'Échec du chargement des portefeuilles'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [topUpFilter]);

  // Handle Approve Top-Up
  const handleApprove = async () => {
    if (!selectedTopUp) return;
    setIsActionLoading(true);
    try {
      await apiClient.post(`/admin/wallet/top-ups/${selectedTopUp.id}/approve`);
      setSuccessMsg(isAr ? `تم اعتماد شحن ${selectedTopUp.amount} أوقية للكابتن بنجاح!` : `Recharge de ${selectedTopUp.amount} MRU approuvée avec succès !`);
      setIsApproveModalOpen(false);
      setSelectedTopUp(null);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || (isAr ? 'فشل اعتماد الطلب' : 'Échec de l\'approbation'));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Reject Top-Up
  const handleReject = async () => {
    if (!selectedTopUp) return;
    if (!rejectReason.trim()) {
      setError(isAr ? 'سبب الرفض إلزامي' : 'Le motif du refus est obligatoire');
      return;
    }
    setIsActionLoading(true);
    try {
      await apiClient.post(`/admin/wallet/top-ups/${selectedTopUp.id}/reject`, { reason: rejectReason.trim() });
      setSuccessMsg(isAr ? 'تم رفض طلب الشحن مع تدوين السبب' : 'Demande rejetée avec motif enregistré');
      setIsRejectModalOpen(false);
      setSelectedTopUp(null);
      setRejectReason('');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || (isAr ? 'فشل رفض الطلب' : 'Échec du rejet'));
    } finally {
      setIsActionLoading(false);
    }
  };

  // Handle Manual Credit / Debit
  const handleManualAction = async () => {
    if (!manualModalCaptain) return;
    const amountNum = parseFloat(manualAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError(isAr ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر' : 'Veuillez saisir un montant valide supérieur à 0');
      return;
    }
    if (!manualReason.trim()) {
      setError(isAr ? 'سبب المعاملة إلزامي للتدقيق الإداري' : 'Le motif est obligatoire pour l\'audit');
      return;
    }

    setIsActionLoading(true);
    try {
      const endpoint = manualModalType === 'credit' ? '/admin/wallet/manual-credit' : '/admin/wallet/manual-debit';
      await apiClient.post(endpoint, {
        driverId: manualModalCaptain.id,
        amount: amountNum,
        reason: manualReason.trim(),
      });
      setSuccessMsg(
        manualModalType === 'credit'
          ? (isAr ? `تم إيداع ${amountNum} أوقية بنجاح للكابتن` : `${amountNum} MRU crédités avec succès`)
          : (isAr ? `تم خصم ${amountNum} أوقية بنجاح من الكابتن` : `${amountNum} MRU débités avec succès`)
      );
      setManualModalCaptain(null);
      setManualAmount('');
      setManualReason('');
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || (isAr ? 'فشل تنفيذ العملية اليدوية' : 'Échec de l\'opération manuelle'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const filteredCaptains = captains.filter((c) => {
    const term = search.toLowerCase();
    return c.name.toLowerCase().includes(term) || c.phone.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-blue-600" />
            {isAr ? 'إدارة الشحن والمحافظ التشغيلية' : 'Gestion des Portefeuilles & Recharges'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAr 
              ? 'متابعة واعتماد طلبات شحن أرصدة الكباتن وإدارة المحافظ التشغيلية وفق نموذج الدفع النقدي'
              : 'Suivi et approbation des recharges des chauffeurs et gestion des soldes opérationnels'}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {isAr ? 'تحديث البيانات' : 'Actualiser'}
        </button>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-green-500 hover:text-green-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 5-Column Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">
              {isAr ? 'إجمالي رحلات الكاش' : 'Volume Courses Cash'}
            </span>
            <DollarSign className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-xl font-bold text-gray-900 mt-2">
            {stats?.totalTripValue?.toLocaleString() || 0} <span className="text-xs font-normal text-gray-500">MRU</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{isAr ? 'يقبضه الكباتن نقداً 100%' : 'Encaissé 100% en cash'}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm bg-blue-50/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700">
              {isAr ? 'عمولة ريم واي (15%)' : 'Commission RIM WAY'}
            </span>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-blue-700 mt-2">
            {stats?.totalCommission?.toLocaleString() || 0} <span className="text-xs font-normal text-blue-500">MRU</span>
          </p>
          <p className="text-xs text-blue-600/80 mt-1">{isAr ? 'إيرادات المنصة المقتطعة' : 'Revenus plateforme'}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">
              {isAr ? 'أرصدة الكباتن التشغيلية' : 'Soldes Chauffeurs'}
            </span>
            <Wallet className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-emerald-600 mt-2">
            {stats?.totalCaptainWallets?.toLocaleString() || 0} <span className="text-xs font-normal text-gray-500">MRU</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{isAr ? 'إجمالي المحافظ المودعة' : 'Total crédits disponibles'}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">
              {isAr ? 'كباتن برصيد مستنفد' : 'Soldes Épuisés'}
            </span>
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-amber-700 mt-2">
            {stats?.exhaustedCaptainsCount || 0}
          </p>
          <p className="text-xs text-amber-600 mt-1">{isAr ? 'محظورون من استقبال الرحلات' : 'Bloqués (solde ≤ 0)'}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm bg-purple-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-700">
              {isAr ? 'طلبات شحن معلقة' : 'Recharges en attente'}
            </span>
            <Clock className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-purple-700 mt-2">
            {stats?.pendingTopUpsCount || 0}
          </p>
          <p className="text-xs text-purple-600 mt-1">{isAr ? 'تتطلب المراجعة والاعتماد' : 'À examiner'}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4 rtl:space-x-reverse">
          <button
            onClick={() => setActiveTab('topups')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 ${
              activeTab === 'topups'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            {isAr ? 'طلبات شحن الأرصدة' : 'Demandes de Recharge'}
            {(stats?.pendingTopUpsCount ?? 0) > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                {stats?.pendingTopUpsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('wallets')}
            className={`py-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 ${
              activeTab === 'wallets'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Wallet className="w-4 h-4" />
            {isAr ? 'محافظ الكباتن والأرصدة' : 'Portefeuilles des Chauffeurs'}
            <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
              {captains.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Tab 1: Top-Up Requests */}
      {activeTab === 'topups' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Sub-Filters */}
          <div className="p-4 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500">{isAr ? 'تصفية حسب الحالة:' : 'Filtrer par statut :'}</span>
              {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setTopUpFilter(filterKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    topUpFilter === filterKey
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {filterKey === 'PENDING' && (isAr ? 'قيد المراجعة' : 'En attente')}
                  {filterKey === 'APPROVED' && (isAr ? 'معتمدة' : 'Approuvées')}
                  {filterKey === 'REJECTED' && (isAr ? 'مرفوضة' : 'Rejetées')}
                  {filterKey === 'ALL' && (isAr ? 'الكل' : 'Tous')}
                </button>
              ))}
            </div>
            <span className="text-xs text-gray-500">
              {isAr ? `إجمالي النتائج: ${topUps.length}` : `Total : ${topUps.length}`}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right rtl:text-right ltr:text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">{isAr ? 'الكابتن' : 'Chauffeur'}</th>
                  <th className="px-4 py-3">{isAr ? 'المبلغ المطلوب' : 'Montant'}</th>
                  <th className="px-4 py-3">{isAr ? 'المرجع / الحوالة' : 'Référence'}</th>
                  <th className="px-4 py-3">{isAr ? 'الملاحظات' : 'Notes'}</th>
                  <th className="px-4 py-3">{isAr ? 'تاريخ الطلب' : 'Date de demande'}</th>
                  <th className="px-4 py-3">{isAr ? 'الحالة' : 'Statut'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topUps.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      {isAr ? 'لا توجد طلبات شحن مطابقة' : 'Aucune demande trouvée'}
                    </td>
                  </tr>
                ) : (
                  topUps.map((req) => {
                    const captainName = req.driver?.user?.name || (isAr ? 'كابتن ريم واي' : 'Chauffeur RIM WAY');
                    const captainPhone = req.driver?.user?.phone || '';
                    const dateFormatted = new Date(req.createdAt).toLocaleString(isAr ? 'ar-MA' : 'fr-FR');

                    return (
                      <tr key={req.id} className="hover:bg-gray-50/80 transition">
                        <td className="px-4 py-3">
                          <Link to={`/captains/${req.driverId}`} className="font-semibold text-blue-600 hover:underline">
                            {captainName}
                          </Link>
                          <div className="text-xs text-gray-400">{captainPhone}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">
                          {req.amount} <span className="text-xs font-normal text-gray-500">MRU</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                            {req.reference || (isAr ? 'تحويل بنكي / كاش' : 'Virement / Cash')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                          {req.notes || '—'}
                          {req.rejectionReason && (
                            <div className="text-red-500 text-xs mt-0.5">
                              {isAr ? `سبب الرفض: ${req.rejectionReason}` : `Motif: ${req.rejectionReason}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {dateFormatted}
                        </td>
                        <td className="px-4 py-3">
                          {req.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                              <Clock className="w-3 h-3" />
                              {isAr ? 'قيد المراجعة' : 'En attente'}
                            </span>
                          )}
                          {req.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3 h-3" />
                              {isAr ? 'معتمد' : 'Approuvé'}
                            </span>
                          )}
                          {req.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              <XCircle className="w-3 h-3" />
                              {isAr ? 'مرفوض' : 'Rejeté'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {req.status === 'PENDING' ? (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedTopUp(req);
                                  setIsApproveModalOpen(true);
                                }}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium shadow-sm transition flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {isAr ? 'اعتماد' : 'Approuver'}
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedTopUp(req);
                                  setIsRejectModalOpen(true);
                                }}
                                className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-xs font-medium transition flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                {isAr ? 'رفض' : 'Rejeter'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Captains Wallets */}
      {activeTab === 'wallets' && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Search bar */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4 bg-gray-50/50">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-2.5 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'بحث باسم الكابتن أو رقم الهاتف...' : 'Rechercher par nom ou téléphone...'}
                className="w-full pr-9 pl-4 rtl:pr-9 rtl:pl-4 ltr:pl-9 ltr:pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <span className="text-xs text-gray-500">
              {isAr ? `إجمالي الكباتن: ${filteredCaptains.length}` : `Total : ${filteredCaptains.length}`}
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right rtl:text-right ltr:text-left">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">{isAr ? 'الكابتن' : 'Chauffeur'}</th>
                  <th className="px-4 py-3">{isAr ? 'المركبة' : 'Véhicule'}</th>
                  <th className="px-4 py-3">{isAr ? 'الحالة التشغيلية' : 'Statut'}</th>
                  <th className="px-4 py-3">{isAr ? 'الرصيد التشغيلي' : 'Solde'}</th>
                  <th className="px-4 py-3">{isAr ? 'حالة الرصيد' : 'Disponibilité'}</th>
                  <th className="px-4 py-3 text-center">{isAr ? 'إجراءات المحفظة' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCaptains.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <Wallet className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      {isAr ? 'لا يوجد كباتن مطابقون' : 'Aucun chauffeur trouvé'}
                    </td>
                  </tr>
                ) : (
                  filteredCaptains.map((cap) => {
                    const isExhausted = cap.walletBalance <= 0;

                    return (
                      <tr key={cap.id} className="hover:bg-gray-50/80 transition">
                        <td className="px-4 py-3">
                          <Link to={`/captains/${cap.id}`} className="font-semibold text-blue-600 hover:underline">
                            {cap.name}
                          </Link>
                          <div className="text-xs text-gray-400">{cap.phone}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {cap.vehicle ? (
                            <span>{cap.vehicle.brand} {cap.vehicle.model} ({cap.vehicle.plateNumber})</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            cap.isOnline ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {cap.isOnline ? (isAr ? 'متصل' : 'En ligne') : (isAr ? 'غير متصل' : 'Hors ligne')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold">
                          <span className={`text-base ${isExhausted ? 'text-red-600' : 'text-emerald-600'}`}>
                            {cap.walletBalance.toLocaleString()}
                          </span>
                          <span className="text-xs font-normal text-gray-500 mr-1 ml-1">MRU</span>
                        </td>
                        <td className="px-4 py-3">
                          {isExhausted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              <AlertTriangle className="w-3 h-3" />
                              {isAr ? 'مستنفد (محظور)' : 'Épuisé (Bloqué)'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              {isAr ? 'جاهز لاستقبال الرحلات' : 'Actif'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setManualModalCaptain(cap);
                                setManualModalType('credit');
                              }}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-medium transition flex items-center gap-1"
                              title={isAr ? 'إيداع يدوي' : 'Crédit manuel'}
                            >
                              <ArrowDownLeft className="w-3 h-3" />
                              {isAr ? 'إيداع' : 'Crédit'}
                            </button>
                            <button
                              onClick={() => {
                                setManualModalCaptain(cap);
                                setManualModalType('debit');
                              }}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-xs font-medium transition flex items-center gap-1"
                              title={isAr ? 'خصم يدوي' : 'Débit manuel'}
                            >
                              <ArrowUpRight className="w-3 h-3" />
                              {isAr ? 'خصم' : 'Débit'}
                            </button>
                            <Link
                              to={`/captains/${cap.id}`}
                              className="px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded text-xs font-medium transition"
                            >
                              {isAr ? 'السجل' : 'Historique'}
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Approve Top-Up */}
      {isApproveModalOpen && selectedTopUp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                {isAr ? 'تأكيد اعتماد شحن الرصيد' : 'Confirmer la recharge'}
              </h3>
              <button onClick={() => setIsApproveModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-green-50/50 p-4 rounded-xl border border-green-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{isAr ? 'الكابتن:' : 'Chauffeur :'}</span>
                <span className="font-semibold text-gray-900">{selectedTopUp.driver?.user?.name || selectedTopUp.driver?.user?.phone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{isAr ? 'المبلغ المراد إيداعه:' : 'Montant à créditer :'}</span>
                <span className="font-bold text-green-700 text-base">{selectedTopUp.amount} MRU</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{isAr ? 'رقم المرجع / الحوالة:' : 'Référence :'}</span>
                <span className="font-mono text-gray-900">{selectedTopUp.reference || '—'}</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              {isAr 
                ? 'عند الاعتماد، ستتم إضافة المبلغ فورياً لمحفظة الكابتن التشغيلية وتسجيل حركة إيداع معتمدة وإشعار الكابتن.'
                : 'En approuvant, le montant sera instantanément crédité au solde opérationnel du chauffeur.'}
            </p>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                disabled={isActionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                {isAr ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isActionLoading}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold shadow-md transition flex items-center gap-2"
              >
                {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isAr ? 'تأكيد الاعتماد والإيداع' : 'Confirmer & Créditer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Reject Top-Up */}
      {isRejectModalOpen && selectedTopUp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                {isAr ? 'رفض طلب شحن الرصيد' : 'Rejeter la demande'}
              </h3>
              <button onClick={() => setIsRejectModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-gray-600">
              {isAr 
                ? `يرجى تدوين سبب رفض طلب الشحن الخاص بالكابتن بمبلغ ${selectedTopUp.amount} أوقية (سيظهر السبب للكابتن في تطبيقه):`
                : `Veuillez spécifier le motif du rejet de la recharge de ${selectedTopUp.amount} MRU :`}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {isAr ? 'سبب الرفض * (إلزامي)' : 'Motif du refus *'}
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={isAr ? 'مثال: رقم الحوالة غير صحيح / لم يتم استلام المبلغ في الحساب...' : 'Ex: Numéro de virement non trouvé / Montant non reçu...'}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                disabled={isActionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                {isAr ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={isActionLoading || !rejectReason.trim()}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-md transition flex items-center gap-2"
              >
                {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {isAr ? 'تأكيد الرفض' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Manual Credit / Debit */}
      {manualModalCaptain && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                {manualModalType === 'credit' ? (
                  <>
                    <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                    {isAr ? 'إيداع رصيد يدوي' : 'Crédit manuel'}
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-5 h-5 text-red-600" />
                    {isAr ? 'خصم رصيد يدوي' : 'Débit manuel'}
                  </>
                )}
              </h3>
              <button onClick={() => setManualModalCaptain(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg text-sm flex justify-between items-center">
              <div>
                <span className="font-semibold text-gray-900">{manualModalCaptain.name}</span>
                <div className="text-xs text-gray-500">{manualModalCaptain.phone}</div>
              </div>
              <div className="text-right rtl:text-right ltr:text-left">
                <div className="text-xs text-gray-400">{isAr ? 'الرصيد الحالي' : 'Solde actuel'}</div>
                <div className="font-bold text-gray-800">{manualModalCaptain.walletBalance} MRU</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isAr ? 'المبلغ (أوقية MRU) *' : 'Montant (MRU) *'}
                </label>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="مثال: 500"
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {isAr ? 'السبب الإداري / المبرر * (إلزامي للتدقيق)' : 'Motif administratif *'}
                </label>
                <textarea
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder={
                    manualModalType === 'credit'
                      ? (isAr ? 'مثال: تسوية إيداع كاش مباشر بالمكتب / مكافأة أداء...' : 'Ex: Dépôt direct en agence...')
                      : (isAr ? 'مثال: تصحيح خطأ إيداع سابق / تسوية غرامة إلغاء...' : 'Ex: Correction erreur de dépôt...')
                  }
                  rows={2}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setManualModalCaptain(null)}
                disabled={isActionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                {isAr ? 'إلغاء' : 'Annuler'}
              </button>
              <button
                type="button"
                onClick={handleManualAction}
                disabled={isActionLoading || !manualAmount || !manualReason.trim()}
                className={`px-5 py-2 text-white rounded-lg text-sm font-semibold shadow-md transition flex items-center gap-2 ${
                  manualModalType === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isActionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {manualModalType === 'credit'
                  ? (isAr ? 'تنفيذ الإيداع' : 'Valider le crédit')
                  : (isAr ? 'تنفيذ الخصم' : 'Valider le débit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
