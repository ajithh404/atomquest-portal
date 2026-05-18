export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A0F1E] px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.22),transparent_32rem),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_28rem),radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_36rem)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/[0.06] to-transparent" />

      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
