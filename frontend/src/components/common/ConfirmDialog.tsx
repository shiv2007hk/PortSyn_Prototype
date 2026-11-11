import type { ReactNode } from "react";
import { Button } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  tone = "danger",
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title={title} description={description}>
        {children ? <div className="text-[12.5px] leading-relaxed text-slate-400">{children}</div> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant={tone} loading={pending} onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
