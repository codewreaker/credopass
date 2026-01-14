
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
// import { SignInForm } from '../../containers/SignInModal';

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
 * Features:
 * - Uses Base UI Dialog for accessible modal behavior
 * - Provides shared overlay with click-outside-to-close
 * - Handles Escape key to close (built into Base UI)
 * - Prevents body scroll when open (built into Base UI)
 * - Applies consistent animations
 */
export default function ModalPortal() {
  const { launcher, closeLauncher } = useLauncher();

  const handleClose = () => {
    launcher?.onClose?.();
    closeLauncher();
  }

  const handleOpenChange = (open: boolean) => {
    console.log('Launcher open change:', open);
    if (open) {
      launcher?.onOpen?.();
    } else {
      handleClose();
    }
  };


  return (
    <Dialog open={launcher.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        {launcher.content || <DefaultModal />}
      </DialogContent>
    </Dialog>
  )
}
