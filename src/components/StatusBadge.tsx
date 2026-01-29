import type { SubmissionStatus } from '@/types';

interface StatusBadgeProps {
  status: SubmissionStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<SubmissionStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-[#BA836B]/10 text-[#BA836B] ring-[#BA836B]/20',
  },
  reviewing: {
    label: 'In Review',
    className: 'bg-[#061E26]/10 text-[#061E26] ring-[#061E26]/20',
  },
  approved: {
    label: 'Approved',
    className: 'bg-green-500/10 text-green-700 ring-green-500/20',
  },
  revision_requested: {
    label: 'Revision Requested',
    className: 'bg-amber-500/10 text-amber-700 ring-amber-500/20',
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full ring-1 ring-inset ${config.className} ${sizeClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {config.label}
    </span>
  );
}
