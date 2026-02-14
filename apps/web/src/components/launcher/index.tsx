import { Button } from "@credopass/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@credopass/ui/components/dialog"
import { useEffect, useCallback } from 'react';

import { useLauncher } from '../../stores/store';

import './launcher.css';


const DefaultModal = () => (
  <>
    <DialogHeader>
      <DialogTitle>Edit profile</DialogTitle>
      <DialogDescription>
        Make changes to your profile here. Click save when you&apos;re
        done.
      </DialogDescription>
    </DialogHeader>
    <div className="grid gap-4">
      {"content goes here"}
    </div>
    <DialogFooter>
      <DialogClose>
        <Button variant="outline">Cancel</Button>
      </DialogClose>
      <Button type="submit">Save changes</Button>
    </DialogFooter>
  </>
);


/**
 * ModalPortal component
 *
 * For command palette: renders as a standalone overlay (no Dialog wrapper)
 * to avoid base-ui Dialog's fixed positioning conflicts.
 * For everything else: uses the Dialog component.
 */
export default function ModalPortal() {
  const { launcher, closeLauncher } = useLauncher();

  const handleClose = useCallback(() => {
    launcher?.onClose?.();
    closeLauncher();
  }, [launcher, closeLauncher]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (open) {
      launcher?.onOpen?.();
    } else {
      handleClose();
    }
  }, [launcher, handleClose]);

  // Detect if content is command palette
  const isCommandPalette =
    launcher.content?.type &&
    typeof launcher.content.type !== 'string' &&
    'name' in launcher.content.type &&
    launcher.content.type.name === 'CommandPalette';

  // Close command palette overlay on Escape
  useEffect(() => {
    if (!isCommandPalette || !launcher.isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isCommandPalette, launcher.isOpen, handleClose]);

  // Command palette: render as standalone overlay (no Dialog)
  if (isCommandPalette && launcher.isOpen) {
    return (
      <>
        {/* Backdrop */}
        <div
          className="cmd-overlay-backdrop"
          onClick={handleClose}
          aria-hidden="true"
        />
        {/* Centered command palette */}
        <div className="cmd-overlay-container" role="dialog" aria-modal="true" aria-label="Command palette">
          <div className="cmd-overlay-content">
            {launcher.content}
          </div>
        </div>
      </>
    );
  }

  // Regular modal: use Dialog
  return (
    <Dialog open={launcher.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="launcher-dialog" showCloseButton>
        {launcher.content || <DefaultModal />}
      </DialogContent>
    </Dialog>
  );
}
