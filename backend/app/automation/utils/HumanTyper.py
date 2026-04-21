
import time
import random
import string
from appium.webdriver.extensions.android.nativekey import AndroidKey

"""
HumanTyper Class
----------------
This class simulates human-like typing behavior on Android devices using Appium.
It introduces randomness, mistakes, pauses, and corrections to mimic realistic
typing patterns instead of robotic, deterministic input.

Inputs:
    - driver (Appium WebDriver): The active Appium driver instance used to send
      key events to the Android device.
    - double_key_chance (float, optional): Probability (default 0.05) that a
      character will be accidentally pressed twice before being corrected.

Key Attributes:
    - SHIFT_META: Constant used to indicate the SHIFT key modifier for uppercase
      letters and symbols requiring SHIFT.
    - LETTER_MAP: Maps lowercase ASCII letters to their corresponding AndroidKey
      codes.
    - DIGIT_MAP: Maps digits (0-9) to AndroidKey codes.
    - SPECIAL_MAP: Maps common special characters (space, newline, tab, punctuation)
      to AndroidKey codes.
    - SHIFT_SYMBOLS: Maps symbols that require SHIFT (e.g., !, @, #, etc.) to
      their base keycodes with SHIFT_META applied.
    - speed_factor: Randomized typing speed multiplier (0.85-1.25) to vary rhythm.
    - total_mistakes: Random number (1-3) of mistakes to be introduced in a typing
      session.
    - mistake_positions: Set of positions in the text where mistakes will occur.

Methods:
    - __init__(driver, double_key_chance=0.05):
        Initializes the HumanTyper with a driver, mistake probability, and
        randomized typing speed.

    - _press_char(ch):
        Sends the correct keycode for a given character `ch`. Handles uppercase,
        digits, special characters, and SHIFT-required symbols. Falls back to
        direct text input if no mapping exists.

    - type_text(text):
        Types the provided string `text` with human-like behavior:
            * Random pauses ("thinking moments").
            * Mistakes at preselected positions:
                - Inserts wrong characters.
                - Deletes them using backspace (DEL).
            * Occasional double keypress errors with correction.
            * Variable delays between keystrokes to simulate rhythm.
            * Longer delays for uppercase or SHIFT-required symbols.

Working:
    1. The class maps characters to Android keycodes.
    2. When typing, it randomly decides where mistakes will occur.
    3. At those positions, wrong characters are typed, then deleted.
    4. Each character is typed with a randomized delay to simulate human rhythm.
    5. Occasionally, a character is pressed twice and corrected.
    6. The overall effect is a natural, imperfect typing pattern that avoids
       detection as automated input.

Use Case:
    This class is useful for automation scenarios where human-like typing is
    required, such as bypassing bot detection systems, testing input fields,
    or simulating realistic user behavior in mobile applications.
"""


class HumanTyper:
    SHIFT_META = 0x00000001

    LETTER_MAP = {ch: getattr(AndroidKey, f"{ch.upper()}") for ch in string.ascii_lowercase}
    DIGIT_MAP = {str(i): getattr(AndroidKey, f"DIGIT_{i}") for i in range(10)}
    SPECIAL_MAP = {
        " ": AndroidKey.SPACE,
        "\n": AndroidKey.ENTER,
        "\t": AndroidKey.TAB,
        "-": AndroidKey.MINUS,
        "=": AndroidKey.EQUALS,
        "[": AndroidKey.LEFT_BRACKET,
        "]": AndroidKey.RIGHT_BRACKET,
        "\\": AndroidKey.BACKSLASH,
        ";": AndroidKey.SEMICOLON,
        "'": AndroidKey.APOSTROPHE,
        ",": AndroidKey.COMMA,
        ".": AndroidKey.PERIOD,
        "/": AndroidKey.SLASH,
        "`": AndroidKey.GRAVE,
    }
    SHIFT_SYMBOLS = {
        "!": AndroidKey.DIGIT_1,
        "@": AndroidKey.DIGIT_2,
        "#": AndroidKey.DIGIT_3,
        "$": AndroidKey.DIGIT_4,
        "%": AndroidKey.DIGIT_5,
        "^": AndroidKey.DIGIT_6,
        "&": AndroidKey.DIGIT_7,
        "*": AndroidKey.DIGIT_8,
        "(": AndroidKey.DIGIT_9,
        ")": AndroidKey.DIGIT_0,
        "_": AndroidKey.MINUS,
        "+": AndroidKey.EQUALS,
        "{": AndroidKey.LEFT_BRACKET,
        "}": AndroidKey.RIGHT_BRACKET,
        "|": AndroidKey.BACKSLASH,
        ":": AndroidKey.SEMICOLON,
        '"': AndroidKey.APOSTROPHE,
        "<": AndroidKey.COMMA,
        ">": AndroidKey.PERIOD,
        "?": AndroidKey.SLASH,
        "~": AndroidKey.GRAVE,
    }

    def __init__(self, driver, double_key_chance=0.05):
        self.driver = driver
        self.double_key_chance = double_key_chance
        self.speed_factor = random.uniform(0.85, 1.25)

        # Decide how many mistakes will happen in this whole typing session (1-3)
        self.total_mistakes = random.randint(1, 3)
        self.mistake_positions = set()

    def _press_char(self, ch):
        if ch.isupper() and ch.lower() in self.LETTER_MAP:
            self.driver.press_keycode(self.LETTER_MAP[ch.lower()], metastate=self.SHIFT_META)
        elif ch in self.LETTER_MAP:
            self.driver.press_keycode(self.LETTER_MAP[ch])
        elif ch in self.SHIFT_SYMBOLS:
            self.driver.press_keycode(self.SHIFT_SYMBOLS[ch], metastate=self.SHIFT_META)
        elif ch in self.DIGIT_MAP:
            self.driver.press_keycode(self.DIGIT_MAP[ch])
        elif ch in self.SPECIAL_MAP:
            self.driver.press_keycode(self.SPECIAL_MAP[ch])
        else:
            self.driver.execute_script("mobile: type", {"text": ch})

    def type_text(self, text):
        # Randomly choose positions in the text where mistakes will happen
        if len(text) > self.total_mistakes:
            self.mistake_positions = set(random.sample(range(len(text)), self.total_mistakes))

        for i, ch in enumerate(text):

            # Occasional "thinking pause"
            if random.random() < 0.05:
                time.sleep(random.uniform(0.25, 0.6) * self.speed_factor)

            # Make a mistake only at preselected positions
            if i in self.mistake_positions:
                wrong_count = random.randint(1, 2)  # usually 1-2 wrong chars
                for _ in range(wrong_count):
                    wrong_char = random.choice(string.ascii_lowercase + string.digits + string.punctuation)
                    self._press_char(wrong_char)
                    time.sleep(random.uniform(0.03, 0.09) * self.speed_factor)

                time.sleep(random.uniform(0.12, 0.35) * self.speed_factor)

                for _ in range(wrong_count):
                    self.driver.press_keycode(AndroidKey.DEL)
                    time.sleep(random.uniform(0.04, 0.12) * self.speed_factor)

                time.sleep(random.uniform(0.08, 0.25) * self.speed_factor)

            # Type the correct character
            self._press_char(ch)

            # Occasional double keypress mistake
            if random.random() < self.double_key_chance:
                self._press_char(ch)
                time.sleep(random.uniform(0.05, 0.12) * self.speed_factor)
                self.driver.press_keycode(AndroidKey.DEL)
                time.sleep(random.uniform(0.05, 0.12) * self.speed_factor)

            # Human typing rhythm
            base_delay = random.uniform(0.05, 0.14) * self.speed_factor
            if ch.isupper() or ch in self.SHIFT_SYMBOLS:
                base_delay += random.uniform(0.04, 0.08) * self.speed_factor
            time.sleep(base_delay)
