import {
  GAMBLE_SUBMENU,
  PAN_KEYS,
  PREVENT_DEFAULT_CODES,
  WASD_PAN_KEYS,
  resolveHotkey,
} from './keymap';
import {
  DEFAULT_INPUT_SETTINGS,
  type BoxSelect,
  type Hotkey,
  type InputController,
  type InputSettings,
  type PointerInput,
  type Viewport,
} from './types';

/** Distance from the viewport edge that starts an edge scroll, in CSS pixels. */
const EDGE_THRESHOLD = 12;
/** Grace period before an edge scroll engages, so a quick pass doesn't scroll. */
const EDGE_ARM_MS = 250;
/** Pointer travel before a left-drag becomes a selection box. */
const BOX_SELECT_THRESHOLD = 6;

export function createInputController(): InputController {
  let enabled = true;
  let settings: InputSettings = { ...DEFAULT_INPUT_SETTINGS };
  let gambleSubmenu = false;

  const held = new Set<string>();
  const modifiers = { shift: false, ctrl: false, alt: false };
  const panAxis = { x: 0, y: 0 };

  let dragPanX = 0;
  let dragPanY = 0;
  let zoomFactor = 1;
  let rotateSteps = 0;

  let pointerInside = false;
  let pointerX = 0;
  let pointerY = 0;
  let edgeEnteredAt = 0;

  let leftDownAt: { x: number; y: number } | null = null;
  let middleDown = false;
  let boxSelect: BoxSelect | null = null;

  const hotkeyHandlers = new Set<(k: Hotkey) => void>();
  const pointerHandlers = new Set<(p: PointerInput) => void>();

  const emitHotkey = (k: Hotkey) => hotkeyHandlers.forEach((cb) => cb(k));
  const emitPointer = (p: PointerInput) => pointerHandlers.forEach((cb) => cb(p));

  function anyHeld(codes: readonly string[]) {
    return codes.some((c) => held.has(c));
  }

  function onKeyDown(e: KeyboardEvent) {
    modifiers.shift = e.shiftKey;
    modifiers.ctrl = e.ctrlKey || e.metaKey;
    modifiers.alt = e.altKey;
    if (!enabled) return;
    held.add(e.code);
    if (PREVENT_DEFAULT_CODES.has(e.code)) e.preventDefault();
    if (e.repeat) return;

    if (gambleSubmenu) {
      const sub = GAMBLE_SUBMENU[e.code];
      if (sub) {
        gambleSubmenu = false;
        emitHotkey(sub);
        return;
      }
    }
    const hotkey = resolveHotkey(e.code, e.shiftKey, settings);
    if (hotkey) {
      if (hotkey === 'GAMBLE') gambleSubmenu = true;
      else if (hotkey === 'CANCEL') gambleSubmenu = false;
      emitHotkey(hotkey);
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    modifiers.shift = e.shiftKey;
    modifiers.ctrl = e.ctrlKey || e.metaKey;
    modifiers.alt = e.altKey;
    held.delete(e.code);
  }

  /** Losing focus must clear held keys or the camera pans forever. */
  function onBlur() {
    held.clear();
    middleDown = false;
    leftDownAt = null;
    boxSelect = null;
    modifiers.shift = modifiers.ctrl = modifiers.alt = false;
  }

  function attach(host: unknown): () => void {
    if (typeof window === 'undefined') return () => {};

    // Keyboard is always window-scoped. Pointer events need a real element —
    // react-native-web forwards a View ref to its DOM node, but a null ref (or
    // native) must not cost us the keyboard.
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    const el = isElement(host) ? host : null;
    if (!el) {
      return () => {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      };
    }

    const rectPoint = (e: PointerEvent | MouseEvent) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!enabled) return;
      const p = rectPoint(e);
      pointerX = p.x;
      pointerY = p.y;
      if (e.button === 0) leftDownAt = { ...p };
      if (e.button === 1) {
        middleDown = true;
        e.preventDefault();
      }
      el.setPointerCapture?.(e.pointerId);
      emitPointer({ kind: 'down', ...p, button: e.button, ...modifierSnapshot(e) });
    };

    const onPointerMove = (e: PointerEvent) => {
      const p = rectPoint(e);
      const dx = p.x - pointerX;
      const dy = p.y - pointerY;
      pointerX = p.x;
      pointerY = p.y;
      pointerInside = true;
      if (!enabled) return;
      if (middleDown) {
        dragPanX += dx;
        dragPanY += dy;
      } else if (leftDownAt) {
        const travel = Math.hypot(p.x - leftDownAt.x, p.y - leftDownAt.y);
        if (travel > BOX_SELECT_THRESHOLD) {
          boxSelect = { x0: leftDownAt.x, y0: leftDownAt.y, x1: p.x, y1: p.y };
        }
      }
      emitPointer({ kind: 'move', ...p, button: -1, ...modifierSnapshot(e) });
    };

    const onPointerUp = (e: PointerEvent) => {
      const p = rectPoint(e);
      el.releasePointerCapture?.(e.pointerId);
      if (e.button === 1) middleDown = false;
      if (e.button === 0) {
        const wasBox = boxSelect;
        leftDownAt = null;
        boxSelect = null;
        if (enabled && !wasBox) {
          emitPointer({ kind: 'click', ...p, button: 0, ...modifierSnapshot(e) });
        }
      }
      if (enabled) emitPointer({ kind: 'up', ...p, button: e.button, ...modifierSnapshot(e) });
    };

    const onPointerLeave = () => {
      pointerInside = false;
      edgeEnteredAt = 0;
    };

    const onWheel = (e: WheelEvent) => {
      if (!enabled) return;
      e.preventDefault();
      zoomFactor *= Math.pow(1.1, e.deltaY / 100);
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      if (!enabled) return;
      const p = rectPoint(e);
      emitPointer({ kind: 'contextmenu', ...p, button: 2, ...modifierSnapshot(e) });
    };

    const onDoubleClick = (e: MouseEvent) => {
      if (!enabled) return;
      const p = rectPoint(e);
      emitPointer({ kind: 'dblclick', ...p, button: 0, ...modifierSnapshot(e) });
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', onContextMenu);
    el.addEventListener('dblclick', onDoubleClick);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', onContextMenu);
      el.removeEventListener('dblclick', onDoubleClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }

  function isElement(host: unknown): host is HTMLElement {
    return (
      !!host &&
      typeof (host as HTMLElement).addEventListener === 'function' &&
      typeof (host as HTMLElement).getBoundingClientRect === 'function'
    );
  }

  function modifierSnapshot(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }) {
    return { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey };
  }

  function update(dt: number, viewport: Viewport) {
    panAxis.x = 0;
    panAxis.y = 0;
    if (!enabled) return;

    const keys = settings.wasdPan ? [PAN_KEYS, WASD_PAN_KEYS] : [PAN_KEYS];
    for (const map of keys) {
      if (anyHeld(map.north)) panAxis.y += 1;
      if (anyHeld(map.south)) panAxis.y -= 1;
      if (anyHeld(map.west)) panAxis.x -= 1;
      if (anyHeld(map.east)) panAxis.x += 1;
    }

    if (settings.edgeScroll && pointerInside && !boxSelect && !middleDown) {
      const nearLeft = pointerX < EDGE_THRESHOLD;
      const nearRight = pointerX > viewport.width - EDGE_THRESHOLD;
      const nearTop = pointerY < EDGE_THRESHOLD;
      const nearBottom = pointerY > viewport.height - EDGE_THRESHOLD;
      const atEdge = nearLeft || nearRight || nearTop || nearBottom;
      const now = performance.now();
      if (!atEdge) {
        edgeEnteredAt = 0;
      } else {
        if (edgeEnteredAt === 0) edgeEnteredAt = now;
        if (now - edgeEnteredAt >= EDGE_ARM_MS) {
          if (nearLeft) panAxis.x -= 1;
          if (nearRight) panAxis.x += 1;
          if (nearTop) panAxis.y += 1;
          if (nearBottom) panAxis.y -= 1;
        }
      }
    }

    // Clamp so diagonal input isn't faster than axis-aligned input.
    const mag = Math.hypot(panAxis.x, panAxis.y);
    if (mag > 1) {
      panAxis.x /= mag;
      panAxis.y /= mag;
    }
    void dt;
  }

  return {
    attach,
    update,
    panAxis,
    consumeDragPan() {
      const out = { dx: dragPanX, dy: dragPanY };
      dragPanX = 0;
      dragPanY = 0;
      return out;
    },
    consumeZoom() {
      const out = zoomFactor;
      zoomFactor = 1;
      return out;
    },
    consumeRotate() {
      const out = rotateSteps;
      rotateSteps = 0;
      return out;
    },
    modifiers,
    get boxSelect() {
      return boxSelect;
    },
    onHotkey(cb) {
      hotkeyHandlers.add(cb);
      return () => hotkeyHandlers.delete(cb);
    },
    onPointer(cb) {
      pointerHandlers.add(cb);
      return () => pointerHandlers.delete(cb);
    },
    setEnabled(v) {
      enabled = v;
      if (!v) onBlur();
    },
    setSettings(next) {
      settings = next;
    },
    dispose() {
      hotkeyHandlers.clear();
      pointerHandlers.clear();
      onBlur();
    },
  };
}
