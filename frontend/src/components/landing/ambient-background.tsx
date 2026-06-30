export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="float absolute -left-32 top-32 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="float-delayed absolute -right-24 top-64 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
      <div className="float-slow absolute left-1/3 top-[480px] h-64 w-64 rounded-full bg-emerald-400/8 blur-3xl" />
    </div>
  );
}
