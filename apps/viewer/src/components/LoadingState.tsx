export function LoadingState() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-black text-white">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      <p className="text-sm uppercase tracking-widest text-white/60">Preparing 360° experience</p>
    </div>
  );
}
