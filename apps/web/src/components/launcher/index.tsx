
import { Button } from "@credopass/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@credopass/ui/components/dialog"
import { Input } from "@credopass/ui/components/input"
import { Label } from "@credopass/ui/components/label"

import { useLauncher } from '../../stores/store';
// import { SignInForm } from '../../containers/SignInModal';
import { X } from 'lucide-react';

import './launcher.css';


const DefaultModal = () => <></>;



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
      <DialogTrigger asChild>
        <Button variant="outline">Open Dialog</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re
            done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 modal-container">
          {launcher?.content || <DefaultModal />}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
