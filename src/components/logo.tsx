import { cn } from "@/lib/utils";

export function Logo({ className, mark = true }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {mark ? (
        <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
          <rect width="32" height="32" rx="8" fill="currentColor" className="text-primary" />
          <path
            d="M16 6.5L6.5 14.2V25a1.5 1.5 0 0 0 1.5 1.5h6.2v-6.4h3.6V26.5H24a1.5 1.5 0 0 0 1.5-1.5V14.2L16 6.5z"
            fill="#F6F3EF"
          />
        </svg>
      ) : null}
      <span className="text-xl font-extrabold tracking-tight text-fg">homezee</span>
    </span>
  );
}
