import React, {useRef, useCallback, useState} from 'react'
/* ----------------------------------------------------------------
   Swipe-to-reveal hook — left-swipe only, reveals action buttons
   ---------------------------------------------------------------- */
const SWIPE_THRESHOLD = 60;
/** Width of one revealed action button; the panel is this times the action count. */
const ACTION_BUTTON_WIDTH = 70;

export function useSwipeToReveal(actionCount = 2) {
    const ACTION_WIDTH = actionCount * ACTION_BUTTON_WIDTH;
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiped, setIsSwiped] = useState(false);
    const startX = useRef(0);
    const startY = useRef(0);
    const currentX = useRef(0);
    const swiping = useRef(false);
    const isHorizontal = useRef<boolean | null>(null);

    const reset = useCallback(() => {
        setOffsetX(0);
        setIsSwiped(false);
    }, []);

    /** Toggle open/closed — used by the desktop more button */
    const toggle = useCallback(() => {
        if (isSwiped) {
            setOffsetX(0);
            setIsSwiped(false);
        } else {
            setOffsetX(-ACTION_WIDTH);
            setIsSwiped(true);
        }
    }, [ACTION_WIDTH, isSwiped]);

    const onTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        startX.current = touch.clientX;
        startY.current = touch.clientY;
        currentX.current = touch.clientX;
        swiping.current = true;
        isHorizontal.current = null;
    }, []);

    const onTouchMove = useCallback((e: React.TouchEvent) => {
        if (!swiping.current) return;
        const touch = e.touches[0];
        const diffX = touch.clientX - startX.current;
        const diffY = touch.clientY - startY.current;

        // Lock direction on first significant movement
        if (isHorizontal.current === null && (Math.abs(diffX) > 5 || Math.abs(diffY) > 5)) {
            isHorizontal.current = Math.abs(diffX) > Math.abs(diffY);
        }

        // If vertical scroll, bail out
        if (isHorizontal.current === false) {
            swiping.current = false;
            return;
        }

        currentX.current = touch.clientX;

        if (isSwiped) {
            // Already open — allow dragging back to the right to close
            const newOffset = Math.min(0, Math.max(-ACTION_WIDTH, -ACTION_WIDTH + diffX));
            setOffsetX(newOffset);
        } else {
            // Closed — only allow left swipe (negative diff)
            const clampedOffset = Math.min(0, Math.max(-ACTION_WIDTH, diffX));
            setOffsetX(clampedOffset);
        }
    }, [ACTION_WIDTH, isSwiped]);

    const onTouchEnd = useCallback(() => {
        swiping.current = false;
        isHorizontal.current = null;

        if (Math.abs(offsetX) >= SWIPE_THRESHOLD) {
            setOffsetX(-ACTION_WIDTH);
            setIsSwiped(true);
        } else {
            setOffsetX(0);
            setIsSwiped(false);
        }
    }, [ACTION_WIDTH, offsetX]);

    return { offsetX, isSwiped, actionWidth: ACTION_WIDTH, reset, toggle, onTouchStart, onTouchMove, onTouchEnd };
}
