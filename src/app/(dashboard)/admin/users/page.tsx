'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useDataCache } from '@/contexts/DataCacheContext';
import { RoleBadge, PageLoading, TableSkeleton, EmptyState } from '@/components';
import type { User, UserRole } from '@/types';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const { getCache, setCache, clearCache } = useDataCache();
  const router = useRouter();
  
  // Initialize with cache if available
  const [users, setUsers] = useState<User[]>(() => {
    return getCache<User[]>('users:admin') || [];
  });
  const [loading, setLoading] = useState(() => {
    return !getCache<User[]>('users:admin');
  });
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  
  // New user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('submitter');
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchUsers = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const cacheKey = 'users:admin';
      
      // Check cache first
      const cachedData = getCache<User[]>(cacheKey);
      if (cachedData && showLoading) {
        setUsers(cachedData);
        setLoading(false);
        setError(null);
        // Still fetch in background to refresh
        showLoading = false;
      }
      
      const response = await fetch('/api/admin/users');
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/admin/dashboard');
          return;
        }
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.data);
      setCache(cacheKey, data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [router, getCache, setCache]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      if (user) {
        const rolePath = user.role === 'reviewer' ? '/reviewer/dashboard' : user.role === 'submitter' ? '/submitter/dashboard' : '/admin/dashboard';
        router.push(rolePath);
      } else {
        router.push('/login');
      }
      return;
    }
    
    const cacheKey = 'users:admin';
    const cachedData = getCache<User[]>(cacheKey);
    
    if (cachedData) {
      // Use cached data immediately, no skeleton
      setUsers(cachedData);
      setLoading(false);
      // Fetch fresh data in background
      fetchUsers(false);
    } else {
      // No cache, fetch with loading
      fetchUsers(true);
    }
  }, [user, router, fetchUsers, getCache]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!showAddForm) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAddForm(false);
        setAddError(null);
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserRole('submitter');
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showAddForm]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setUsers(prev => {
        const updated = prev.map(u => (u.id === userId ? { ...u, role: newRole } : u));
        // Update cache with new data
        setCache('users:admin', updated);
        return updated;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setAddingUser(true);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          role: newUserRole,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        throw new Error(`Server error: ${text.substring(0, 200)}`);
      }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setUsers(prev => [data.data, ...prev]);
      // Clear cache so fresh data is fetched
      clearCache('users:admin');
      setShowAddForm(false);
      setAddError(null);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('submitter');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAddingUser(false);
    }
  };

  if (user?.role !== 'admin') {
    return <PageLoading />;
  }

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-black">User Management</h1>
          <p className="mt-3 text-lg font-light tracking-wide text-black/70">
            Manage user accounts and roles
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="group relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#061E26] to-black text-white rounded-xl font-semibold shadow-lg shadow-[#061E26]/30 hover:shadow-xl hover:shadow-[#061E26]/40 hover:scale-105 transition-all duration-200"
        >
          <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Add user modal */}
      {showAddForm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" 
          onClick={() => {
            setShowAddForm(false);
            setAddError(null);
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserRole('submitter');
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-xl border border-black/10 p-6 w-full max-w-md animate-fade-in" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-black">Add New User</h2>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setAddError(null);
                  setNewUserEmail('');
                  setNewUserPassword('');
                  setNewUserRole('submitter');
                }}
                className="p-2 rounded-lg text-black/40 hover:text-black/60 hover:bg-black/5 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {addError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl mb-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{addError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="newUserEmail" className="block text-sm font-semibold text-black/80 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="newUserEmail"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="block w-full px-4 py-2.5 border border-black/20 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] transition-shadow"
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="newUserPassword" className="block text-sm font-semibold text-black/80 mb-2">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    id="newUserPassword"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="block w-full px-4 py-2.5 border border-black/20 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] transition-shadow"
                    placeholder="Minimum 6 characters"
                    minLength={6}
                  />
                  <p className="mt-2 text-xs text-black/50">
                    Password must be at least 6 characters
                  </p>
                </div>
              </div>
              <div className="sm:w-48">
              <label htmlFor="newUserRole" className="block text-sm font-semibold text-black/80 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="newUserRole"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="block w-full px-4 py-2.5 border border-black/20 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] transition-shadow"
              >
                <option value="submitter">Submitter</option>
                <option value="reviewer">Reviewer</option>
                <option value="admin">Admin</option>
              </select>
              </div>
              <div className="pt-3">
              <button
                type="submit"
                disabled={addingUser}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#061E26] to-black text-white rounded-xl font-semibold shadow-lg shadow-[#061E26]/30 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {addingUser ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add User
                  </>
                )}
              </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl mb-6 shadow-sm">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-black/10 p-6">
          <TableSkeleton rows={5} />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && users.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-black/10">
          <EmptyState
            title="No users found"
            description="Add your first user to get started"
            icon={
              <svg className="h-full w-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
          />
        </div>
      )}

      {/* Users table */}
      {!loading && !error && users.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-black/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black/10">
              <thead className="bg-gradient-to-r from-white to-black/5">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-black/5">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-black/5 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-black">{u.email}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono text-black/50 bg-black/5 px-2 py-1 rounded">{u.id}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-black/50">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          disabled={updatingUserId === u.id || u.id === user?.id}
                          className="px-3 py-1.5 text-sm border border-black/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#061E26] focus:border-[#061E26] disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                        >
                          <option value="submitter">Submitter</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>
                        {u.id === user?.id && (
                          <span className="text-xs font-medium text-black/50 bg-black/5 px-2 py-1 rounded-full">(you)</span>
                        )}
                        {updatingUserId === u.id && (
                          <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
