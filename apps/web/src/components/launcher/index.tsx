import { Dialog } from '@base-ui/react/dialog';
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
    <Dialog.Root open={launcher.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-overlay" />
        <Dialog.Popup className="modal-container">
          <Dialog.Close className="modal-close" aria-label="Close modal" >
            <X size={14} />
          </Dialog.Close>
          {launcher?.content || <DefaultModal />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
