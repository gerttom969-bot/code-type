// The press/hold behaviour of the difficulty pie as a pure state machine.
//   press:   show the three colours while the finger or mouse is down
//   hold:    five seconds later, start turning
//   release: stop turning (the colours stay shown)
//   click:   a quick tap on an already shown pie hides it again (a click that ends a hold does nothing)
//   toggle:  keyboard Enter or Space shows or hides
export const initialPie = Object.freeze({ revealed: false, spinning: false, pressed: false, wasRevealed: false, held: false });

export function pieReduce(state, event) {
  switch (event) {
    case "press": return { revealed: true, spinning: false, pressed: true, wasRevealed: state.revealed, held: false };
    case "hold": return state.pressed ? { ...state, spinning: true, held: true } : state;
    case "release": return { ...state, spinning: false, pressed: false };
    case "click": return state.held ? { ...state, held: false } : state.wasRevealed ? { ...state, revealed: false, wasRevealed: false } : state;
    case "toggle": return { ...state, revealed: !state.revealed, spinning: false };
    default: throw new TypeError(`Unknown pie event: ${event}`);
  }
}
