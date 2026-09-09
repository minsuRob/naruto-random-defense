'use no memo';

import { useEffect, useRef } from 'react';

import type { InputController } from '@/game/input/types';

/**
 * The green drag rectangle.
 *
 * Driven straight off the input controller in its own rAF loop: the rectangle
 * changes every mouse move, and routing that through React state would re-render
 * the HUD on every pixel.
 */
export function SelectionBox({ input }: { input: InputController }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el) return;

      const box = input.boxSelect;
      if (!box) {
        if (el.style.display !== 'none') el.style.display = 'none';
        return;
      }
      el.style.display = 'block';
      el.style.left = `${Math.min(box.x0, box.x1)}px`;
      el.style.top = `${Math.min(box.y0, box.y1)}px`;
      el.style.width = `${Math.abs(box.x1 - box.x0)}px`;
      el.style.height = `${Math.abs(box.y1 - box.y0)}px`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [input]);

  return (
    <div
      ref={ref}
      style={{
        display: 'none',
        position: 'absolute',
        border: '1px solid #5fd08a',
        backgroundColor: 'rgba(95,208,138,0.12)',
        pointerEvents: 'none',
      }}
    />
  );
}
