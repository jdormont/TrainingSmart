import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, MessageCircle, Calendar, Settings, User } from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import { stravaApi } from '../../services/stravaApi';

export const Header: React.FC = () => {
  const location = useLocation();
  const isAuthenticated = stravaApi.isAuthenticated();

  const navigation = [
    { name: 'Dashboard', href: ROUTES.DASHBOARD, icon: Activity },
    { name: 'Chat', href: ROUTES.CHAT, icon: MessageCircle },
    { name: 'Plans', href: ROUTES.PLANS, icon: Calendar },
    { name: 'Settings', href: ROUTES.SETTINGS, icon: Settings },
  ];

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to={ROUTES.DASHBOARD} className="flex items-center space-x-2">
            <Activity className="w-8 h-8 text-orange-500" />
            <span className="text-xl font-bold text-gray-900">TrainingSmart</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-orange-600 bg-orange-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center">
            <button className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100">
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-gray-200">
          <div className="flex justify-around py-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex flex-col items-center space-y-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-orange-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
};