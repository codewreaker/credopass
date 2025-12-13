import { Dialog } from '@base-ui/react/dialog';
import { useAppStore } from '../../store';
import { SignInForm } from '../../containers/SignInModal';
import { EventForm } from '../EventForm';
import { MODALS, type ModalId } from './useModal';
import { X } from 'lucide-react';

import './modal.css';


const DefaultModal = (args: unknown) => <code>{JSON.stringify(args)}</code>;


// Define modal map outside of component to avoid creating components during render
const MODAL_COMPONENTS: Record<ModalId | 'default', React.ComponentType<any>> = {
  [MODALS.ADD_USER]: SignInForm,
  [MODALS.ADD_EVENT]: EventForm,
  default: DefaultModal,
};

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
  const { modal, closeModal } = useAppStore();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeModal();
    }
  };

  const ModalElement = modal.modalId 
    ? MODAL_COMPONENTS[modal.modalId as ModalId] || MODAL_COMPONENTS.default
    : DefaultModal;

  return (
    <Dialog.Root open={modal.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="modal-overlay" />
        <Dialog.Popup className="modal-container">
          <Dialog.Close className="modal-close" aria-label="Close modal">
            <X size={18} />
          </Dialog.Close>
          <ModalElement {...(modal.content ?? {})} onClose={closeModal} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
