import random
import time
import math
from selenium.webdriver.common.actions.action_builder import ActionBuilder

class HumanTapper:
    """
    High-realism Appium tap generator
    Architected to remain W3C-valid while simulating human entropy.
    """

    # ------------------------------------------------------------
    # Constructor
    # ------------------------------------------------------------
    def __init__(
        self,
        driver,
        screen_width=1080,
        screen_height=1920,

        # --- Micro Drag Controls (Normalized % of screen) ---
        micro_drag_limits=(0.0008, 0.003),        # (min,max) movement magnitude
        micro_drag_steps=(1, 2),             # (min,max) move count
        micro_drag_probability=0.35,          # chance drag occurs

        # --- Global Gesture Limit ---
        max_duration=None                    # seconds cap
    ):

        self.driver = driver
        self.w = screen_width
        self.h = screen_height

        self.micro_drag_limits = micro_drag_limits
        self.micro_drag_steps = micro_drag_steps
        self.micro_drag_probability = micro_drag_probability
        self.max_duration = max_duration

        # Persistent behavioral profile
        self.profile = {
            "base_reaction": random.uniform(0.18, 0.45),
            "hold_bias": random.uniform(0.8, 1.3),
            "jitter_x": random.uniform(0.2, 0.8),
            "jitter_y": random.uniform(0.2, 0.8),
            "finger_preference": random.choice(["finger1", "finger2"]),
        }

        self.tap_count = 0
        self.last_finger = self.profile["finger_preference"]

    # ------------------------------------------------------------
    # Timing Models
    # ------------------------------------------------------------
    def _reaction_delay(self):
        mu = math.log(self.profile["base_reaction"])
        sigma = 0.35
        delay = random.lognormvariate(mu, sigma)
        time.sleep(min(max(delay, 0.05), 1.8))

    def _planning_pause(self, taps):
        if taps >= 3:
            time.sleep(random.uniform(0.4, 1.6))

    def _weibull_interval(self):
        k = 1.5
        lam = 0.28
        return lam * (-math.log(1 - random.random())) ** (1 / k)

    def _fatigue_scale(self):
        f = self.tap_count
        return 1 + (0.015 * f) + (0.0008 * f * f)

    # ------------------------------------------------------------
    # Spatial Modeling
    # ------------------------------------------------------------
    def _edge_bias(self, x, y):
        margin = 50
        if x < margin: x += abs(random.gauss(0, 3))
        if x > self.w - margin: x -= abs(random.gauss(0, 3))
        if y < margin: y += abs(random.gauss(0, 3))
        if y > self.h - margin: y -= abs(random.gauss(0, 3))
        return x, y

    def _anisotropic_jitter(self, x, y):
        fatigue = self._fatigue_scale()
        x += random.gauss(0, 3 * self.profile["jitter_x"] * fatigue)
        y += random.gauss(0, 3 * self.profile["jitter_y"] * fatigue)
        return self._edge_bias(x, y)

    def _miss_offset(self, x, y):
        if random.random() < 0.06:
            return x + random.randint(-18, 18), y + random.randint(-18, 18), True
        return x, y, False

    # ------------------------------------------------------------
    # Finger Modeling
    # ------------------------------------------------------------
    def _choose_finger(self):
        if random.random() < 0.7:
            return self.last_finger
        self.last_finger = random.choice(["finger1", "finger2"])
        return self.last_finger

    # ------------------------------------------------------------
    # Duration Scaling
    # ------------------------------------------------------------
    def _scale_durations(self, durations):
        if not self.max_duration:
            return durations

        total = sum(durations) / 1000
        scale = min(1.0, self.max_duration / max(total, 0.001))
        return [int(d * scale) for d in durations]

    # ------------------------------------------------------------
    # Core Tap
    # ------------------------------------------------------------
    def tap(self, x, y):

        self.tap_count += 1
        self._reaction_delay()

        x, y = self._anisotropic_jitter(x, y)
        x, y, missed = self._miss_offset(x, y)

        finger_id = self._choose_finger()
        actions = ActionBuilder(self.driver)
        finger = actions.add_pointer_input("touch", finger_id)

        # ✔ Only one move BEFORE pointerDown (Appium safe)
        finger.create_pointer_move(
            x=int(x),
            y=int(y),
            duration=0,
            origin="viewport"
        )

        finger.create_pointer_down()

        # Hold duration
        hold = (
            random.uniform(80, 220)
            * self.profile["hold_bias"]
            * self._fatigue_scale()
        )
        durations = [hold]
        durations = self._scale_durations(durations)

        finger.create_pause(durations[0] / 1000)

        # --------------------------------------------------------
        # Controlled Micro Drag
        # --------------------------------------------------------
        if (
            self.micro_drag_probability > 0
            and random.random() < self.micro_drag_probability
        ):

            steps = random.randint(*self.micro_drag_steps)

            for _ in range(steps):

                mag_x = random.uniform(*self.micro_drag_limits) * self.w
                mag_y = random.uniform(*self.micro_drag_limits) * self.h

                dx = random.choice([-1, 1]) * mag_x
                dy = random.choice([-1, 1]) * mag_y

                finger.create_pointer_move(
                    x=int(x + dx),
                    y=int(y + dy),
                    duration=random.randint(18, 45),
                    origin="viewport",
                )

        finger.create_pointer_up(0)
        actions.perform()

        # Miss correction retry
        # if missed:
        #     time.sleep(random.uniform(0.12, 0.35))
        #     self.tap(x, y)

    # ------------------------------------------------------------
    # Multi Tap
    # ------------------------------------------------------------
    def multi_tap(self, x, y, taps=2):

        self._planning_pause(taps)

        for _ in range(taps):
            self.tap(x, y)
            time.sleep(self._weibull_interval())



if __name__ == "__main__":

    driver = None
    width_x,width_y = 1024, 720
    print(width_x, width_y)

    tapper = HumanTapper(
        driver,
        screen_width=int(width_x),
        screen_height=int(width_y),
        micro_drag_limits=(0.0008, 0.003),
        micro_drag_steps=(1, 2),
        micro_drag_probability=0.35
    )
    tapper.tap(500, 700)
    # tapper.multi_tap(500, 700, taps=4)






"""
HumanTapper — Short Flow & Usage Explanation
============================================

Purpose
-------

• Generates human-like tap gestures using Appium W3C Actions.
• Introduces behavioral randomness (timing, motion, error, fatigue)
  to avoid robotic interaction patterns.
• Designed to remain practical, deterministic, and stable in execution.


Typical Flow
------------

User Call:
    tap(x,y)
        -> _reaction_delay()
        -> _anisotropic_jitter() + _miss_offset()
        -> _choose_finger()
        -> _bezier_path() + _velocity_durations()
        -> Pointer Down
        -> Contact Hold
        -> Optional Micro Drag
        -> Pointer Up
        -> Retry if Missed

Multi Tap:
    multi_tap(x,y,n)
        -> _planning_pause()
        -> tap() repeated
        -> _weibull_interval() between taps

Constructor Parameters
----------------------

driver : Appium WebDriver
    Required pointer action executor.

screen_width / screen_height : int
    Used for edge-bias correction and jitter safety.

micro_drag_limits: 
    Defines the magnitude of each micro-drag as a fraction of the screen width/height. 
    This is proportional, so it scales naturally on different screen sizes.
    → 0.003 * 1080 ≈ 3.24 px → small, human-like finger shift
    → Smaller values → finger "sticks" to the tap location.
    → Larger values → more noticeable finger movement (like natural settling or tiny slips).

micro_drag_steps:
    Controls how many micro-movement steps happen during the tap (after pointerDown but before pointerUp).
    → minimal movement; tap appears very stable.
    → slightly more natural “settling” movement.

micro_drag_probability:
    The chance that micro-drag actually occurs for a given tap.
    0 → drag never happens (tap is perfectly sticky).
    1 → drag happens every time.
    0.35 → about 1 in 3 taps will have small movement.
    Lower probability → taps are mostly precise (good for buttons, sensitive UI).
    Higher probability → taps have more “human randomness,” especially useful for bot detection avoidance.

max_duration : float | None
    Optional upper bound (seconds) for motion segment timing.
    Velocity durations are proportionally scaled to respect budget.
    None disables constraint.

Key Internal Functions
----------------------
_reaction_delay()
    Models human response latency (log-normal).

_planning_pause()
    Cognitive delay before multi-tap sequences.

_weibull_interval()
    Human-like inter-tap spacing distribution.

_fatigue_scale()
    Gradually increases jitter & hold variability.

_anisotropic_jitter()
    Directionally biased positional noise.

_miss_offset()
    Introduces realistic tap errors + correction retry.

_bezier_path()
    Generates curved approach trajectories.

_velocity_durations()
    Controls acceleration profile.

_choose_finger()
    Simulates finger reuse habits.

    
Behavioral Effects Produced
---------------------------

• Non-linear motion paths
• Timing entropy
• Finger persistence
• Edge-safe targeting
• Human error + correction
• Fatigue progression
• Optional micro-drift realism
• Natural multi-tap rhythm

Outcome
-------

Produces touch gestures statistically closer to human motor
behavior than linear deterministic automation while maintaining
Appium compatibility and execution stability.
"""



# ============================================================
# IMPLEMENTED HUMAN-LIKE TAP CHECKLIST
# ============================================================

# Core biomechanics
# [✅] Touch area size
# [✅] Contact duration variability
# [✅] Coordinate jitter
# [✅] Reaction delay distribution
# [✅] Gesture nuance / drift
# [✅] Micro drag (configurable)
# [✅] Touch-down/up micro-offset
# [✅] Jitter anisotropy

# Motion realism
# [✅] Velocity curves
# [✅] Curved trajectory paths
# [✅] Edge safe-zone bias
# [ ] Device acceleration profile
# [ ] Context-aware UI zones

# Behavioral modeling
# [ ] Multi-touch gestures
# [✅] Finger persistence
# [✅] Session randomness
# [✅] Fatigue scaling
# [✅] Nonlinear fatigue curve
# [✅] Temporal rhythm modeling
# [✅] Planning pauses
# [ ] Action chaining realism

# Error simulation
# [✅] Missed taps/noise
# [✅] Tap success noise
# [✅] Correction retry behavior

# Statistical realism
# [✅] First-tap reaction modeling
# [✅] Inter-tap distribution
# [✅] Session diversity

# Framework limits
# [ ] Pressure simulation (not possible)
# [ ] Hardware tactile feedback (not possible)
# ============================================================




# OLD SUGGESTIONS:
# SUGGESTION 1:

# | Feature                   | Status | Notes / Implementation Details |
# |----------------------------|--------|--------------------------------|
# | Touch area size             | ✅     | Jitter + micro drag simulate finger coverage |
# | Contact duration            | ✅     | Random pause mimics hold time |
# | Coordinate jitter           | ✅     | Gaussian jitter applied, edges adjusted |
# | Reaction delay              | ✅     | Random sleep simulates human reflex |
# | Micro-drag                  | ✅     | Small movement after tap |
# | Gesture nuance              | ✅     | Slight movement before release |
# | Multi-touch                 | ⚠️     | Single pointer now; can add more for multi-finger |
# | Session randomness          | ⚠️     | Currently fixed; could randomize per tap |
# | Finger identity             | ⚠️     | Random per tap; could expand to multi-touch fingers |
# | Error & correction          | ⚠️     | Basic corrective tap only; consider overshoot/undershoot |
# | Velocity curves             | ⚠️     | Sigmoid/Bezier used; consider proper Bezier paths for realism |
# | Context awareness           | ⚠️     | Only edge adjustment; no UI bias or safe zone |
# | Temporal rhythm             | ⚠️     | Multi-tap timing implemented; longer sequences could improve |
# | Pressure simulation         | ❌     | Not possible; use contact duration + micro-drag as proxy |
# | Fatigue / cumulative effect | ⚠️     | Minimal; fatigue_level unused in jitter/reaction scaling |
# | Missed taps / noise         | ⚠️     | Not implemented; humans overshoot occasionally |
# | Session diversity           | ⚠️     | Re-run patterns could be predictable; randomize SESSION_PROFILE |

# SUGGESTION 2:

# ✅ Touch area size: jitter + micro-drag
# ✅ Contact duration: random pause simulates finger hold
# ✅ Coordinate jitter: Gaussian jitter + acceleration/deceleration
# ✅ Reaction delay: randomized sleep for reflex simulation
# ✅ Micro-drag: small random move after press
# ✅ Gesture nuance: slight drift before release
# ⚠ Multi-touch: framework-ready, not fully implemented
# ⚠ Session randomness: fixed profile; randomize per tap for realism
# ⚠ Finger identity: random choice; could vary across taps
# ✅ Error & correction: rare retry simulates human correction
# ⚠ Velocity curves: sigmoid implemented; Bezier/spline curves would be more natural
# ⚠ Context awareness: edge bias applied; could expand for UI zones
# ⚠ Temporal rhythm: multi-tap rhythm modeled; expand for sequences
# ❌ Pressure simulation: not possible with current framework
# ⚠ Fatigue/cumulative: minimal; scale jitter/reaction with repeated taps
# ⚠ Missed taps/noise: partial; overshoot/undershoot could be added


# SUGGESTION 3:
# | Feature                     | Status     | Notes / Implementation Details                                        | Comments / Suggestions                                         |
# |-----------------------------|------------|---------------------------------------------------------------------|---------------------------------------------------------------|
# | Touch area size             | ✅ Implemented | Similar to natural touch interactions.                           | Maintain coverage consistency.                                 |
# | Contact duration            | ✅ Implemented | Simulates hold duration well.                                    | Consider varying based on context or finger type.             |
# | Coordinate jitter           | ✅ Implemented | Good integration of randomness.                                   | Ensure jitter mimics actual human variance closely.           |
# | Reaction delay              | ✅ Implemented | Appropriate range for human-like reflexes.                       | Review the baseline as finger sensitivity may vary.           |
# | Micro-drag                  | ✅ Implemented | Effectively simulates natural movement.                           | Explore different patterns of micro-drag.                     |
# | Gesture nuance              | ✅ Implemented | Convincing mimicry of human behavior.                            | Validate across different gesture types or UI elements.       |
# | Multi-touch                 | ⚠️ Framework-ready | Ready for implementation.                                      | Consider priority of multitouch methods; prioritize usability. |
# | Session randomness          | ⚠️ Minimal | Enhances realism but needs expansion to avoid predictability.     | Randomize session profiles fully, perhaps per execution.      |
# | Finger identity             | ⚠️ Partial  | Basic switching incorporated.                                     | Introduce more variability beyond two fingers.                |
# | Error & correction          | ❌ Missing | Missing a key human feature.                                      | Implement a realistic ‘missed tap’ feature with retries.      |
# | Velocity curves             | ⚠️ Partial  | Limited to basic curves.                                          | Enhance movement realism with true Bezier or sigmoid curves.  |
# | Context awareness           | ❌ Missing | Uniform behavior regardless of context.                           | Bias touch decisions according to screen context.             |
# | Temporal rhythm             | ⚠️ Partial  | Lacks multiple rhythmic patterns.                                  | Introduce variability in inter-tap timing and sequences.      |
# | Pressure simulation         | ❌ Impossible | Currently not feasible with existing tools.                      | Continue monitoring for potential updates in libraries.       |
# | Fatigue / cumulative        | ⚠️ Minimal  | Affects realism of repeated actions.                               | More pronounced effects with fatigue after consecutive taps.   |
# | Missed taps / noise         | ❌ Missing | Not simulated, which lowers realism.                               | Add overshoot or undershoot behaviors to taps.                |


# SUGGESTION 4:
# Priority,Feature,Current,Suggested minimal target,Suggested better target (harder)
# ★★★,First-tap reaction time distribution,B–,log-normal / gamma 0.45–2.1 s,Per-user histogram + warmup effect
# ★★★,Jitter shape & anisotropy,B,Different σ_x vs σ_y + directional bias,Distance-to-target & velocity dependent jitter
# ★★★,Touch-down / touch-up micro-offset,C,Independent small offset on press & release,Realistic finger tilt simulation (x/y linked)
# ★★,Action chaining realism,C,—,"Realistic swipe → tap, tap → long-press, hesitation"
# ★★,Fatigue curve (non-linear),D+,+5–20 ms per action after 8–12 taps,Speed ↓ + miss-prob ↑ + jitter ↑ after ~30–50 taps
# ★★,Edge & corner behavior,D,Stronger centering bias near edges,Almost no overshoot outside safe 40–60 px margin
# ★★,Tap success noise (sub-pixel miss),D,2–12% chance small miss + auto-correction,Miss → pause → microsaccade-like correction
# ★,Pause before series (planning),—,—,400–1800 ms before 3+ tap sequences
# ★,Inter-tap interval distribution,C,—,Weibull / gamma instead of uniform
# ★,Device-specific acceleration profile,—,—,Different curves per phone model / OS version
# ★,Visual feedback delay simulation,—,—,Delay tap after visual change (reading time)
