import type { UserRole } from '@/types';

interface RoleBadgeProps {
  role: UserRole;
}

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  submitter: {
    label: 'Submitter',
    className: 'bg-black/5 text-black/70 ring-black/10',
  },
  reviewer: {
    label: 'Reviewer',
    className: 'bg-[#BA836B]/10 text-[#BA836B] ring-[#BA836B]/20',
  },
  admin: {
    label: 'Admin',
    className: 'bg-[#061E26]/10 text-[#061E26] ring-[#061E26]/20',
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
