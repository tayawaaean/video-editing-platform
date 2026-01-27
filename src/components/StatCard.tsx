import { ReactNode } from 'react';

export type Tone = 'blue' | 'amber' | 'fuchsia' | 'emerald';

export function StatCard({
  label,
  value,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: Tone;
}) {
  const toneMap: Record<Tone, { bg: string; ring: string }> = {
    blue: { bg: 'from-blue-500 to-indigo-600', ring: 'ring-white/40' },
    amber: { bg: 'from-amber-500 to-orange-600', ring: 'ring-white/40' },
    fuchsia: { bg: 'from-fuchsia-500 to-pink-600', ring: 'ring-white/40' },
    emerald: { bg: 'from-emerald-500 to-teal-600', ring: 'ring-white/40' },
  };

  const t = toneMap[tone];

  return (
    <div
      className="group relative overflow-hidden rounded-2xl bg-white p-6 border border-slate-200/60 ring-1 ring-black/5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-600">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
        </div>
        <div className="relative">
          <div
            className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${t.bg} text-white ring-1 ${t.ring} shadow-[0_10px_25px_-10px_rgba(0,0,0,0.35)]`}
          >
            {icon}
          </div>
          <div className="pointer-events-none absolute -inset-2 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-b from-transparent to-slate-100/50" />
        </div>
      </div>
    </div>
  );
}
