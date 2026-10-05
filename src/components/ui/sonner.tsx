import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast: "bg-elevated text-fg border-border shadow-card",
        },
      }}
    />
  );
}
