'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** 'destructive' shows the red Confirm button (default for deletes). */
  confirmVariant?: 'primary' | 'destructive';
  onConfirm: () => Promise<void> | void;
}

/**
 * Replacement for `window.confirm()` so delete prompts match the rest of
 * the admin's dark-mode-aware design instead of showing the browser's
 * native chrome with the URL host ("80.241.222.224 says...") visible.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmVariant = 'destructive',
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
      }}
      title={title}
      description={description}
      size="sm"
    >
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => onOpenChange(false)}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant={confirmVariant}
          onClick={handleConfirm}
          disabled={busy}
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
