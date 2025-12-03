import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Shield, Search, CheckCircle, XCircle, Users, Clock, UserCheck, UserX, Loader2 } from 'lucide-react';

type UserProfile = {
  id: string;
  user_id: string;
  full_name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

type FilterStatus = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

export function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, filterStatus]);

  const loadUsers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-users`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load users');
      }

      const { users: data } = await response.json();
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(term) ||
          user.id.toLowerCase().includes(term)
      );
    }

    if (filterStatus !== 'ALL') {
      filtered = filtered.filter((user) => user.status === filterStatus);
    }

    setFilteredUsers(filtered);
  };

  const updateUserStatus = async (userId: string, status: string) => {
    setActionLoading(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-user-status`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, status }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user status');
      }

      await loadUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const approveUser = async (userId: string) => {
    await updateUserStatus(userId, 'APPROVED');
  };

  const rejectUser = async (userId: string) => {
    if (!confirm('Are you sure you want to reject this user?')) return;
    await updateUserStatus(userId, 'REJECTED');
  };

  const getStats = () => {
    return {
      total: users.length,
      pending: users.filter((u) => u.status === 'PENDING').length,
      approved: users.filter((u) => u.status === 'APPROVED').length,
      rejected: users.filter((u) => u.status === 'REJECTED').length,
    };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="text-center py-12">
        <Shield className="w-12 h-12 text-orange-600 mx-auto mb-4 animate-pulse" />
        <p className="text-gray-600">Loading user management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-orange-100 rounded-lg">
          <Shield className="w-8 h-8 text-orange-600" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Admin Dashboard</h2>
          <p className="text-gray-600">Manage user access and approvals</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-6 h-6 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">Total Users</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>

        <div className="bg-amber-50 rounded-xl p-6 shadow-sm border border-amber-200">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-6 h-6 text-amber-600" />
            <span className="text-sm font-medium text-amber-900">Pending</span>
          </div>
          <p className="text-3xl font-bold text-amber-900">{stats.pending}</p>
        </div>

        <div className="bg-green-50 rounded-xl p-6 shadow-sm border border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <UserCheck className="w-6 h-6 text-green-600" />
            <span className="text-sm font-medium text-green-900">Approved</span>
          </div>
          <p className="text-3xl font-bold text-green-900">{stats.approved}</p>
        </div>

        <div className="bg-red-50 rounded-xl p-6 shadow-sm border border-red-200">
          <div className="flex items-center gap-3 mb-2">
            <UserX className="w-6 h-6 text-red-600" />
            <span className="text-sm font-medium text-red-900">Rejected</span>
          </div>
          <p className="text-3xl font-bold text-red-900">{stats.rejected}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="flex gap-2 flex-wrap">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as FilterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filterStatus === status
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Name</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">User ID</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Admin</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Signed Up</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{user.full_name}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm text-gray-600 font-mono">{user.user_id.slice(0, 8)}...</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          user.status === 'APPROVED'
                            ? 'bg-green-100 text-green-800'
                            : user.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.status === 'APPROVED' && <CheckCircle className="w-3 h-3" />}
                        {user.status === 'PENDING' && <Clock className="w-3 h-3" />}
                        {user.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                        {user.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {user.is_admin && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Shield className="w-3 h-3" />
                          Admin
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {user.status === 'PENDING' && !user.is_admin && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => approveUser(user.user_id)}
                            disabled={actionLoading === user.user_id}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-1 disabled:opacity-50"
                          >
                            {actionLoading === user.user_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Approve
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => rejectUser(user.user_id)}
                            disabled={actionLoading === user.user_id}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition flex items-center gap-1 disabled:opacity-50"
                          >
                            {actionLoading === user.user_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                Reject
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
