import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Clock, XCircle } from 'lucide-react';

type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export function AccountStatus() {
  const [status, setStatus] = useState<UserStatus>('PENDING');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select('status')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setStatus(data.status as UserStatus);
    } catch (error) {
      console.error('Error loading status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return null;
  if (status === 'APPROVED') return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-orange-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {status === 'PENDING' && (
          <>
            <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-10 h-10 text-amber-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Account Pending Approval</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Your account has been created successfully. An administrator will review and approve
              your account shortly. You'll receive access once approved.
            </p>
          </>
        )}
        {status === 'REJECTED' && (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Account Not Approved</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Unfortunately, your account was not approved. Please contact an administrator for
              more information.
            </p>
          </>
        )}
        <button
          onClick={handleSignOut}
          className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
