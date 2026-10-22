import { useEffect, type RefObject } from 'react';

/**
 * Keeps the composer above the on-screen keyboard. Ported from the zip build.
 * Android (interactive-widget=resizes-content) resizes the layout itself;
 * iOS Safari doesn't, so this reads visualViewport and exposes the covered
 * height as --kb on the app root. The chat drawer sits at bottom: var(--kb).
 */
export function useKeyboardInset(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const covered = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        // Below ~80px it's browser chrome moving, not a keyboard.
        const kb = covered > 80 ? covered : 0;
        root.current?.style.setProperty('--kb', `${kb}px`);
        root.current?.classList.toggle('kb-open', kb > 0);
      });
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      cancelAnimationFrame(raf);
    };
  }, [root]);
}
