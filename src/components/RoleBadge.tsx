import type { UserRole } from '@/types';

interface RoleBadgeProps {
  role: UserRole;
}

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  submitter: {
    label: 'Submitter',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  reviewer: {
    label: 'Reviewer',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  admin: {
    label: 'Admin',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
};

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-sm font-medium rounded-full border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
