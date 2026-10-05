import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-sm font-medium text-fg",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
