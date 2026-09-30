
import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useLanguageStore } from '../../store/languageStore';
import { LayoutDashboard, Car, Users, Wallet, BadgeDollarSign, MessageSquareWarning, Activity, LogOut, Languages, Settings } from 'lucide-react';
import apiClient from '../../api/client';
import clsx from 'clsx';

export default function AdminLayout() {
  const { logout, user } = useAuthStore();
  const { language, dir, setLanguage, t } = useLanguageStore();
  const location = useLocation();
  const [pendingTopUps, setPendingTopUps] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await apiClient.get('/admin/wallet/stats');
        setPendingTopUps(res.data?.pendingTopUpsCount || 0);
      } catch {}
    };
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const navigation = [
    { name: t('nav_dashboard'), href: '/', icon: LayoutDashboard },
    { name: t('nav_rides'), href: '/rides', icon: Car },
    { name: t('nav_captains'), href: '/captains', icon: Users },
    { name: t('nav_wallets'), href: '/wallets', icon: Wallet, badge: pendingTopUps },
    { name: t('nav_pricing'), href: '/pricing', icon: BadgeDollarSign },
    { name: t('nav_complaints'), href: '/complaints', icon: MessageSquareWarning },
    { name: t('nav_activity'), href: '/activity', icon: Activity },
    { name: 'إعدادات النظام', href: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row" dir={dir}>
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <span className="text-xl font-bold">RIM WAY Admin</span>
          <button
            onClick={() => setLanguage(language === 'ar' ? 'fr' : 'ar')}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-blue-400 font-semibold px-2 py-1 rounded flex items-center gap-1"
            title="Changer la langue / تغيير اللغة"
          >
            <Languages className="w-3.5 h-3.5" />
            {language === 'ar' ? 'Français' : 'العربية'}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={clsx(
                  isActive ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                  'group flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md'
                )}
              >
                <div className="flex items-center">
                  <item.icon className="mr-3 ml-3 flex-shrink-0 h-5 w-5" aria-hidden="true" />
                  {item.name}
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm truncate text-gray-300">{user?.phone}</span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white"
              title={t('logout')}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
