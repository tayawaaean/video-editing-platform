interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="text-center py-16 px-4">
      {icon && (
        <div className="mx-auto mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-black/5 to-black/10 text-black/40">
            <div className="h-8 w-8">
              {icon}
            </div>
          </div>
        </div>
      )}
      <h3 className="text-xl font-semibold text-black">{title}</h3>
      {description && (
        <p className="mt-3 text-base text-black/70 max-w-md mx-auto">{description}</p>
      )}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

// Default icon for empty submission list
export function VideoIcon() {
  return (
    <svg
      className="h-full w-full"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}
