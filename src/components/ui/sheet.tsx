import { Drawer } from "vaul";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const Sheet = Drawer.Root;
export const SheetTrigger = Drawer.Trigger;
export const SheetClose = Drawer.Close;

export function SheetContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Drawer.Content>) {
  return (
    <Drawer.Portal>
      <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/45" />
      <Drawer.Content
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-elevated text-fg outline-none",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-border" />
        <div className="max-h-[82dvh] overflow-y-auto px-5 pt-4 pb-8">{children}</div>
      </Drawer.Content>
    </Drawer.Portal>
  );
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof Drawer.Title>) {
  return <Drawer.Title className={cn("font-display text-xl font-medium", className)} {...props} />;
}
