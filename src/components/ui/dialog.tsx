import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-[80] bg-black/45" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed left-1/2 top-1/2 z-[80] grid w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 gap-3 rounded-2xl border border-border bg-bg p-4 text-fg shadow-xl",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return <DialogPrimitive.Title className={cn("text-base font-semibold", className)} {...props} />;
}

function DialogClose({ className, ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close className={cn("text-sm text-fg-muted", className)} {...props} />;
}

export { Dialog, DialogClose, DialogContent, DialogTitle };
