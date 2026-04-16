export function AdSkeleton({ className }: { className?: string }) {
  return (
    <div className={`skeleton-shimmer rounded-xl ${className ?? ""}`} />
  );
}
