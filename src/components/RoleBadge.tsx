import type { UserRole } from '@/types';

interface RoleBadgeProps {
  role: UserRole;
}

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  submitter: {
    label: 'Submitter',
    className: 'bg-slate-100 text-slate-700 ring-slate-600/20',
  },
  reviewer: {
    label: 'Reviewer',
    className: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  },
  admin: {
    label: 'Admin',
    className: 'bg-red-50 text-red-700 ring-red-600/20',
  },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full ring-1 ring-inset ${config.className}`}
    >
      {config.label}
    </span>
  );
}
