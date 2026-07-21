import { useCallback, useEffect, useRef, useState } from 'react';

export function useJourneyControls(options?: { onEscape?: () => void }) {
  const directionRef = useRef<-1 | 0 | 1>(0);
  const interactRef = useRef(false);
  const [direction, setDirectionState] = useState<-1 | 0 | 1>(0);

  const setDirection = useCallback((next: -1 | 0 | 1) => {
    directionRef.current = next;
    setDirectionState(next);
  }, []);

  const requestInteract = useCallback(() => {
    interactRef.current = true;
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') setDirection(-1);
      if (event.code === 'ArrowRight' || event.code === 'KeyD') setDirection(1);
      if (event.code === 'KeyE' || event.code === 'Enter') {
        event.preventDefault();
        requestInteract();
      }
      if (event.code === 'Escape') options?.onEscape?.();
    };
    const up = (event: KeyboardEvent) => {
      if ((event.code === 'ArrowLeft' || event.code === 'KeyA') && directionRef.current === -1) setDirection(0);
      if ((event.code === 'ArrowRight' || event.code === 'KeyD') && directionRef.current === 1) setDirection(0);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [options, requestInteract, setDirection]);

  return { direction, directionRef, interactRef, setDirection, requestInteract };
}
