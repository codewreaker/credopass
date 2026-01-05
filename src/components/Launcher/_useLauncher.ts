import type { EventFormData } from '../../containers/EventForm/index.js';


// ─────────────────────────────────────────────────────────────────────────────
// Modal Registry - Add new modal IDs here
// ─────────────────────────────────────────────────────────────────────────────
export const MODALS = {
  ADD_EVENT: 'add_event',
  ADD_USER: 'add_user',
  // Future modals can be added here
} as const;

export type ModalId = typeof MODALS[keyof typeof MODALS];

// ─────────────────────────────────────────────────────────────────────────────
// Type-safe props mapping - Define props for each modal here
// ─────────────────────────────────────────────────────────────────────────────
export interface ModalPropsMap {
  [MODALS.ADD_EVENT]: { initialData?: Partial<EventFormData>; isEditing?: boolean };
  [MODALS.ADD_USER]: Record<string, never>; // No props required
}

// ─────────────────────────────────────────────────────────────────────────────
// Type-safe openModal signature
// ─────────────────────────────────────────────────────────────────────────────
type OpenModalFn = <T extends ModalId>(
  modalId: T,
  ...args: ModalPropsMap[T] extends Record<string, never> 
    ? [] 
    : [props: ModalPropsMap[T]]
) => void;

/**
 * useModal hook - Provides type-safe API for opening/closing modals
 * 
 * @example
 * const { openModal, closeModal } = useModal();
 * 
 * // Type-safe: TS knows ADD_EVENT requires { initialData?, isEditing? }
 * openModal(MODALS.ADD_EVENT, { initialData: {...}, isEditing: false });
 * 
 * // Type-safe: ADD_USER requires no props
 * openModal(MODALS.ADD_USER);
 * 
 * closeModal(); // Closes any open modal
 */
export function useModal() {
  const openModal =(...args: any[] )=>{
    console.log("open modal", args);
  }

  const closeModal =()=>{
    console.log("close modal", closeModal);
  }

 

  return {
    openModal,
    closeModal,
    isModalOpen: false,
    currentModalId: null,
  };
}
