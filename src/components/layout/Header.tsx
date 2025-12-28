import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, MessageCircle, Calendar, Settings, User, LogOut, Shield, BookOpen } from 'lucide-react';
import { ROUTES } from '../../utils/constants';
import { useAuth } from '../../contexts/AuthContext';

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  const navigation = [
    { name: 'Dashboard', href: ROUTES.DASHBOARD, icon: Activity },
    { name: 'Chat', href: ROUTES.CHAT, icon: MessageCircle },
    { name: 'Plans', href: ROUTES.PLANS, icon: Calendar },
    { name: 'Learn', href: ROUTES.LEARN, icon: BookOpen },
    { name: 'Settings', href: ROUTES.SETTINGS, icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Activity className="w-8 h-8 text-orange-500" />
              <span className="text-xl font-bold text-gray-900">TrainingSmart</span>
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                to="/privacy"
                className="flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
              >
                <Shield className="w-4 h-4" />
                <span>Privacy</span>
              </Link>
              <Link
                to="/login"
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </header>
    );
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
          <div className="relative flex items-center" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="p-2 rounded-full text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <User className="w-5 h-5" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 top-12 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900">
                    {user.user_metadata?.full_name || 'User'}
                  </p>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
                <Link
                  to="/privacy"
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Shield className="w-4 h-4" />
                  <span>Privacy & Data</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
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