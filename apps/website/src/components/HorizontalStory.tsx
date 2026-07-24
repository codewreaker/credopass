import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/* ------------------------------------------------------------------ *
 * Horizontal-scroll storytelling primitives.
 *
 * The pattern: a tall <section> whose inner viewport is `position: sticky`.
 * As the page scrolls vertically past the section, we map that vertical
 * progress (0→1) onto a horizontal translate of the panel track — so the
 * reader "scrolls sideways" through a persona's journey without leaving the
 * normal page scroll. Parallax layers read the same 0→1 progress and move at
 * fractional rates for depth.
 *
 * Accessibility: `prefers-reduced-motion` (and no-JS / SSR) collapse the whole
 * thing to an ordinary horizontally-scrollable strip — no pinning, no
 * translate maths — so content is never trapped or hidden.
 * ------------------------------------------------------------------ */

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));

export interface StoryProgress {
  /** 0 → 1 across the pinned scroll. */
  progress: number;
}

interface HorizontalStoryProps {
  /** Renders the moving track; receives live progress for inner parallax. */
  children: (p: StoryProgress) => ReactNode;
  /** Sticky overlay (persona header, progress bar) — pinned, not translated. */
  overlay?: (p: StoryProgress) => ReactNode;
  /** Decorative parallax layers behind the track. */
  backdrop?: (p: StoryProgress) => ReactNode;
  /** How much vertical scroll the pin lasts, in viewport heights. */
  lengthVh?: number;
  className?: string;
}

export function HorizontalStory({
  children,
  overlay,
  backdrop,
  lengthVh = 320,
  className = '',
}: HorizontalStoryProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = section.getBoundingClientRect();
        const total = section.offsetHeight - window.innerHeight;
        const p = total > 0 ? clamp(-rect.top / total) : 0;
        // Distance the track can travel to reveal its overflow.
        const distance = Math.max(0, track.scrollWidth - window.innerWidth);
        track.style.transform = `translate3d(${-(p * distance)}px,0,0)`;
        setProgress(p);
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduced]);

  // Reduced-motion / fallback: plain sideways-scroll strip.
  if (reduced) {
    return (
      <section className={`py-12 ${className}`}>
        {overlay && <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-6">{overlay({ progress: 0 })}</div>}
        <div className="flex gap-4 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-4 snap-x snap-mandatory">
          {children({ progress: 0 })}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className={`relative ${className}`}
      style={{ height: `${lengthVh}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center">
        {backdrop && <div className="pointer-events-none absolute inset-0">{backdrop({ progress })}</div>}

        {overlay && (
          <div className="absolute top-0 left-0 right-0 z-20 pt-20 sm:pt-24">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">{overlay({ progress })}</div>
          </div>
        )}

        <div
          ref={trackRef}
          className="relative z-10 flex items-center gap-5 sm:gap-8 pl-4 sm:pl-8 lg:pl-16 pr-[30vw] will-change-transform"
          style={{ transform: 'translate3d(0,0,0)' }}
        >
          {children({ progress })}
        </div>
      </div>
    </section>
  );
}

/** A translate helper for parallax layers driven by story progress. */
export function parallax(progress: number, distance: number) {
  return `translate3d(${-(progress * distance)}px,0,0)`;
}
