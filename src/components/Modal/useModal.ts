import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAppStore } from '../../store';

/**
 * useModal hook - Provides API for opening/closing modals
 * Components can pass any React element/component to be rendered in the modal.
 * The modal acts as a pure container with no business logic.
 * 
 * Usage:
 * const { openModal, closeModal } = useModal();
 * openModal(<MyForm onSubmit={handleSubmit} />);
 */
export function useModal() {
  const { modal, openModal: storeOpenModal, closeModal: storeCloseModal } = useAppStore();

  const openModal = useCallback((content: ReactNode) => {
    storeOpenModal(content);
  }, [storeOpenModal]);

  const closeModal = useCallback(() => {
    storeCloseModal();
  }, [storeCloseModal]);

  return {
    openModal,
    closeModal,
    isModalOpen: modal.isOpen,
  };
}
