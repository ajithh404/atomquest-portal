import Image from 'next/image';
import { Activity, ShieldCheck, Target } from 'lucide-react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell relative min-h-screen overflow-hidden bg-[#07111F] px-5 py-5 text-white sm:px-8 lg:px-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_36%,rgba(5,150,105,0.24),transparent_28rem),radial-gradient(circle_at_74%_52%,rgba(16,185,129,0.12),transparent_26rem),radial-gradient(circle_at_top_left,rgba(37,99,235,0.13),transparent_34rem)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.027)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.027)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-white/[0.05] to-transparent" />
      <div className="absolute bottom-[-18rem] left-1/4 h-[34rem] w-[34rem] rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden flex-col justify-center py-3 lg:flex">
          <div>
            <div className="mb-9 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/45 bg-emerald-400/10 shadow-[0_0_28px_rgba(16,185,129,0.28)]">
                <Image src="/logo.png" width={26} height={26} alt="AtomQuest logo" className="h-6 w-6 rounded-lg object-cover" priority />
              </div>
              <div className="text-[25px] font-extrabold tracking-[-0.5px]">
                Atom<span className="text-emerald-400">Quest</span>
              </div>
            </div>

            <h1 className="max-w-xl text-[32px] font-extrabold leading-[1.12] tracking-[-1px] text-white xl:text-[36px]">
              Every <span className="text-emerald-400">target</span>.<br />
              Every <span className="text-emerald-400">quarter</span>.
            </h1>
            <p className="mt-5 max-w-lg text-[14.75px] leading-7 text-white/58">
              AtomQuest helps teams set goals, track progress, and achieve more — together.
            </p>

            <div className="auth-dashboard-preview mt-6">
              <div className="auth-preview-sidebar">
                <div className="mb-5 flex items-center gap-2 text-xs font-bold text-white">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">AQ</div>
                  AtomQuest
                </div>
                {['Dashboard', 'Goals', 'Achievements', 'Reviews', 'Reports'].map((item, index) => (
                  <div key={item} className={index === 0 ? 'auth-preview-nav active' : 'auth-preview-nav'}>
                    <span className="h-3 w-3 rounded-sm border border-current/50" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex-1 p-4">
                <div className="mb-4 text-xs font-bold text-white">Dashboard</div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    ['Total Goals', '128', '+12.5%'],
                    ['Completed', '96', '+8.3%'],
                    ['In Progress', '24', '-4.2%'],
                  ].map(([label, value, trend]) => (
                    <div key={label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.045] p-2.5 shadow-[0_12px_28px_rgba(2,6,23,0.16)]">
                      <div className="truncate text-[10px] font-bold text-white/70">{label}</div>
                      <div className="mt-1.5 text-lg font-bold text-white">{value}</div>
                      <div className={trend.startsWith('+') ? 'mt-1 text-[10px] font-bold text-emerald-400' : 'mt-1 text-[10px] font-bold text-red-400'}>
                        {trend}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Goal Progress</span>
                    <span className="text-[11px] font-semibold text-white/60">Last 7 days</span>
                  </div>
                  <div className="auth-chart">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="grid grid-cols-3 gap-5">
              {[
                {
                  title: 'Aligned Goals',
                  copy: 'Connect strategy to\neveryday executions',
                  icon: Target,
                },
                {
                  title: 'Live Insights',
                  copy: 'Track real progress\nin real time.',
                  icon: Activity,
                },
                {
                  title: 'Accountability',
                  copy: 'Drive ownership and\ndeliver outcomes.',
                  icon: ShieldCheck,
                },
              ].map((feature) => (
                <div key={feature.title} className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.18)]">
                    <feature.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{feature.title}</div>
                    <p className="mt-1 whitespace-pre-line text-xs leading-5 text-white/54">{feature.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-[420px] flex-col items-center justify-center lg:justify-end">
          {children}
        </section>
      </div>
    </div>
  );
}
