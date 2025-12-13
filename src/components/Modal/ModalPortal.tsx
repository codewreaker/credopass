import { createPortal } from 'react-dom';
import { useAppStore } from '../../store';
import './modal.css';

/**
 * ModalPortal component - Pure presentation layer for modals
 * Simply renders whatever React node is passed to it via the modal system.
 * Uses React Portal to render at document.body level, avoiding CSS stacking,
 * overflow, and z-index issues.
 * 
 * This component contains NO business logic - it's just a container.
 */
export default function ModalPortal() {
  const { modal } = useAppStore();

  if (!modal.isOpen || !modal.content) {
    return null;
  }

  // Use portal to render modal content at document.body level
  return createPortal(
    modal.content,
    document.body
  );
}
