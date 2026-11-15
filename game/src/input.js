// Keyboard and mouse input plus pointer lock, extended from the kit starter's input module:
// one-shot `pressed` codes for actions (reload, slots, grenades), right-mouse state for the
// sniper scope, and wheel deltas for weapon cycling. Plain browser APIs only.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const pressed = new Set();
  const state = { keys, locked: false, firing: false, rmb: false, lookX: 0, lookY: 0, wheel: 0 };

  window.addEventListener('keydown', (event) => {
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'KeyB') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); state.firing = false; state.rmb = false; });
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.lookX += event.movementX;
    state.lookY += event.movementY;
  });
  window.addEventListener('mousedown', (event) => {
    if (!state.locked) return;
    if (event.button === 0) state.firing = true;
    if (event.button === 2) state.rmb = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
    if (event.button === 2) state.rmb = false;
  });
  window.addEventListener('wheel', (event) => { if (state.locked) state.wheel += Math.sign(event.deltaY); }, { passive: true });
  window.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) { keys.clear(); state.firing = false; state.rmb = false; }
    onLockChange(state.locked);
  });

  return {
    state,
    pressed,
    requestLock() { canvas.requestPointerLock(); },
    takeLook() {
      const out = { x: state.lookX, y: state.lookY };
      state.lookX = 0; state.lookY = 0;
      return out;
    },
    takeWheel() { const w = state.wheel; state.wheel = 0; return w; },
  };
}
