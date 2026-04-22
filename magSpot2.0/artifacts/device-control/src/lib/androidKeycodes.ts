/**
 * Maps browser KeyboardEvent.code → Android KeyEvent keycode.
 * Used for both scrcpy control messages (TYPE_KEYCODE) and
 * adb shell input keyevent (for non-printable keys).
 */
export const BROWSER_KEYCODE_MAP = new Map<string, number>([
  ["Backquote",68],["Backslash",73],["BracketLeft",71],["BracketRight",72],
  ["Comma",55],["Digit0",7],["Digit1",8],["Digit2",9],["Digit3",10],
  ["Digit4",11],["Digit5",12],["Digit6",13],["Digit7",14],["Digit8",15],["Digit9",16],
  ["Equal",70],
  ["KeyA",29],["KeyB",30],["KeyC",31],["KeyD",32],["KeyE",33],["KeyF",34],
  ["KeyG",35],["KeyH",36],["KeyI",37],["KeyJ",38],["KeyK",39],["KeyL",40],
  ["KeyM",41],["KeyN",42],["KeyO",43],["KeyP",44],["KeyQ",45],["KeyR",46],
  ["KeyS",47],["KeyT",48],["KeyU",49],["KeyV",50],["KeyW",51],["KeyX",52],
  ["KeyY",53],["KeyZ",54],
  ["Minus",69],["Period",56],["Quote",75],["Semicolon",74],["Slash",76],
  ["Delete",112],["End",123],["Home",122],["Insert",124],["PageDown",93],["PageUp",92],
  ["AltLeft",57],["AltRight",58],["Backspace",67],["CapsLock",115],
  ["ControlLeft",113],["ControlRight",114],["Enter",66],
  ["MetaLeft",117],["MetaRight",118],["ShiftLeft",59],["ShiftRight",60],
  ["Space",62],["Tab",61],
  ["ArrowLeft",21],["ArrowUp",19],["ArrowRight",22],["ArrowDown",20],
  ["NumLock",143],["Numpad0",144],["Numpad1",145],["Numpad2",146],["Numpad3",147],
  ["Numpad4",148],["Numpad5",149],["Numpad6",150],["Numpad7",151],["Numpad8",152],
  ["Numpad9",153],["NumpadAdd",157],["NumpadComma",159],["NumpadDecimal",158],
  ["NumpadDivide",154],["NumpadEnter",160],["NumpadEqual",161],
  ["NumpadMultiply",155],["NumpadSubtract",156],
  ["Escape",111],
  ["F1",131],["F2",132],["F3",133],["F4",134],["F5",135],["F6",136],
  ["F7",137],["F8",138],["F9",139],["F10",140],["F11",141],["F12",142],
  ["Fn",119],["PrintScreen",120],["Pause",121],["ScrollLock",116],
  ["IntlRo",217],["IntlYen",216],["KanaMode",218],
]);

/**
 * Returns true when the key is a printable single character AND
 * it is safe to pass directly to `adb shell input text <char>`.
 * Space is excluded because command.split() in the Flask backend
 * would swallow it — space is handled via keyevent 62 instead.
 */
export function isPrintableKey(event: KeyboardEvent): boolean {
  return event.key.length === 1 && event.key !== " ";
}

/**
 * Compute the Android KeyEvent metaState from a browser KeyboardEvent.
 */
export const META_ALT_ON         = 0x00000002;
export const META_SHIFT_ON       = 0x00000001;
export const META_CTRL_ON        = 0x00001000;
export const META_META_ON        = 0x00010000;
export const META_CAPS_LOCK_ON   = 0x00100000;
export const META_SCROLL_LOCK_ON = 0x00400000;
export const META_NUM_LOCK_ON    = 0x00200000;

export function keyMetaState(e: KeyboardEvent): number {
  return (
    (e.getModifierState("Alt")        ? META_ALT_ON        : 0) |
    (e.getModifierState("Shift")      ? META_SHIFT_ON      : 0) |
    (e.getModifierState("Control")    ? META_CTRL_ON       : 0) |
    (e.getModifierState("Meta")       ? META_META_ON       : 0) |
    (e.getModifierState("CapsLock")   ? META_CAPS_LOCK_ON  : 0) |
    (e.getModifierState("ScrollLock") ? META_SCROLL_LOCK_ON : 0) |
    (e.getModifierState("NumLock")    ? META_NUM_LOCK_ON   : 0)
  );
}
