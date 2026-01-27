import type { SubmissionStatus } from '@/types';

interface StatusBadgeProps {
  status: SubmissionStatus;
  size?: 'sm' | 'md';
}

const statusConfig: Record<SubmissionStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  reviewing: {
    label: 'In Review',
    className: 'bg-purple-50 text-purple-700 ring-purple-600/20',
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
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
