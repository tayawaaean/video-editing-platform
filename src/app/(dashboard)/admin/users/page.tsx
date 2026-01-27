'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RoleBadge, PageLoading, TableSkeleton, EmptyState } from '@/components';
import type { User, UserRole } from '@/types';

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  
  // New user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserUid, setNewUserUid] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('submitter');
  const [addingUser, setAddingUser] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          router.push('/admin/dashboard');
          return;
        }
        throw new Error(data.error || 'Failed to fetch users');
      }

      setUsers(data.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (user?.role !== 'admin') {
      if (user) {
        const rolePath = user.role === 'reviewer' ? '/reviewer/dashboard' : user.role === 'submitter' ? '/submitter/dashboard' : '/dashboard';
        router.push(rolePath);
      } else {
        router.push('/login');
      }
      return;
    }
    fetchUsers();
  }, [user, router, fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setUpdatingUserId(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setUsers(prev =>
        prev.map(u => (u.id === userId ? { ...u, role: newRole } : u))
      );
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
          supabase_uid: newUserUid,
          email: newUserEmail,
          role: newUserRole,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setUsers(prev => [data.data, ...prev]);
      setShowAddForm(false);
      setNewUserEmail('');
      setNewUserUid('');
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
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="mt-3 text-lg font-light tracking-wide text-slate-600">
            Manage user accounts and roles
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="group relative inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 transition-all duration-200"
        >
          {showAddForm ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </>
          )}
        </button>
      </div>

      {/* Add user form */}
      {showAddForm && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/50 p-6 mb-8 animate-fade-in">
          <h2 className="text-xl font-bold text-slate-900 mb-5">Add New User</h2>
          
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
                <label htmlFor="newUserUid" className="block text-sm font-semibold text-slate-700 mb-2">
                  Supabase UID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="newUserUid"
                  required
                  value={newUserUid}
                  onChange={(e) => setNewUserUid(e.target.value)}
                  className="block w-full px-4 py-2.5 border border-slate-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                  placeholder="UUID from Supabase Auth"
                />
                <p className="mt-2 text-xs text-slate-500">
                  User must already exist in Supabase Auth
                </p>
              </div>
              <div>
                <label htmlFor="newUserEmail" className="block text-sm font-semibold text-slate-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="newUserEmail"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="block w-full px-4 py-2.5 border border-slate-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                  placeholder="user@example.com"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <label htmlFor="newUserRole" className="block text-sm font-semibold text-slate-700 mb-2">
                Role <span className="text-red-500">*</span>
              </label>
              <select
                id="newUserRole"
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                className="block w-full px-4 py-2.5 border border-slate-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
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
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/50 p-6">
          <TableSkeleton rows={5} />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && users.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/50">
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
        <div className="bg-white rounded-xl shadow-sm border border-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Supabase UID
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-slate-900">{u.email}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2 py-1 rounded">{u.supabase_uid}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                          disabled={updatingUserId === u.id || u.supabase_uid === user?.supabase_uid}
                          className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-shadow"
                        >
                          <option value="submitter">Submitter</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>
                        {u.supabase_uid === user?.supabase_uid && (
                          <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">(you)</span>
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
