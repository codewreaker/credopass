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
 * ModalPortal component - Centralized modal container using Base UI Dialog
 *
 * Renders the launcher store content inside a Dialog overlay.
 * Used for command palette, forms (event/user/sign-in), etc.
 */
export default function ModalPortal() {
  const { launcher, closeLauncher } = useLauncher();

  const handleClose = () => {
    launcher?.onClose?.();
    closeLauncher();
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      launcher?.onOpen?.();
    } else {
      handleClose();
    }
  };

  // Detect if content is a command palette (no close button, tighter padding)
  const isCommandPalette =
    launcher.content?.type &&
    typeof launcher.content.type !== 'string' &&
    'name' in launcher.content.type &&
    launcher.content.type.name === 'CommandPalette';

  return (
    <Dialog open={launcher.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className={
          isCommandPalette
            ? 'launcher-dialog launcher-command-mode'
            : 'launcher-dialog'
        }
        showCloseButton={!isCommandPalette}
      >
        {launcher.content || <DefaultModal />}
      </DialogContent>
    </Dialog>
  );
}
