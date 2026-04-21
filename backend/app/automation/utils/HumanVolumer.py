import subprocess
import random
import time
import threading

"""
Human-like Android volume controller using pure ADB commands.

Overview:
    - Connects to a target Android device via `adb connect`.
    - Focuses on controlling STREAM_MUSIC volume for the active playback device.
    - Simulates realistic human interaction with volume keys (pauses, hesitation).
    - Provides both direct percentage-based control and random entropy-driven changes.

Args:
    device_ip (str): IP address (with optional port) of the target Android device.
                    Example: "192.168.1.55:5555"

Key Methods:
    - get_volume_percentage(): Returns current music volume as a percentage of max.
    - increase_volume(steps): Simulates pressing Volume Up key N times.
    - decrease_volume(steps): Simulates pressing Volume Down key N times.
    - mute(): Sends Volume Mute key event.
    - unmute(): Sends a single Volume Up key to clear mute state.
    - set_volume_percentage(percent): Adjusts volume to target percentage (0-100).
    - random_volume_change(do_mute=True): Applies weighted random changes for entropy.

Random Volume Change Behavior:
    - If do_mute=True:
        * 20% chance → mute (0%).
        * 20% chance → set volume to 100%.
        * 45% chance → random between 70-90%.
        * 25% chance → random between 50-70%.
        * 10% chance → random between 20-50%.
    - If do_mute=False:
        * 5% chance → mute (0%).
        * 5% chance → set volume to 100%.
        * 45% chance → random between 70-90%.
        * 25% chance → random between 50-70%.
        * 10% chance → random between 20-50%.

Notes:
    - Max volume (usually 15 steps) is treated as 100%.
    - Percentages are mapped to discrete steps with rounding.
    - Random pauses and hesitation are added to mimic human behavior.
"""


class HumanVolumer:

    def __init__(self, device_ip: str):
        self.device = device_ip if ":" in device_ip else f"{device_ip}:5555"
        subprocess.run(["adb", "connect", self.device], capture_output=True, text=True)

    # -------------------------------
    # Helpers
    # -------------------------------
    def _adb(self, args: list) -> str:
        result = subprocess.run(["adb", "-s", self.device] + args,
                                capture_output=True, text=True)
        return result.stdout.strip()


    def _press_key(self, keycode: int, presses: int = 1):
        for i in range(presses):
            self._adb(["shell", "input", "keyevent", str(keycode)])
            # Human-like pause: sometimes short, sometimes longer
            if random.random() < 0.2:
                time.sleep(random.uniform(0.3, 0.6))  # simulate hesitation
            else:
                time.sleep(random.uniform(0.12, 0.35))


    def _get_stream_music_block(self) -> list:
        out = self._adb(["shell", "dumpsys", "audio"])
        lines = out.splitlines()
        block, capture = [], False
        for line in lines:
            if "STREAM_MUSIC" in line:
                capture = True
            elif capture and line.strip().startswith("- STREAM_") and "STREAM_MUSIC" not in line:
                break
            elif capture:
                block.append(line.strip())
        return block


    def _get_active_device(self) -> str:
        block = self._get_stream_music_block()
        for line in block:
            if line.startswith("Devices:"):
                return line.split(":")[1].strip()
        return "default"


    def _get_current_volume(self) -> int:
        block = self._get_stream_music_block()
        active = self._get_active_device()

        for line in block:
            if line.startswith("Current:"):
                parts = line.replace("Current:", "").split(",")
                for part in parts:
                    part = part.strip()
                    if active in part:
                        try:
                            # Example: "2 (speaker): 15\150"
                            after_colon = part.split(":")[-1].strip()
                            # If format is "15\150", take first number
                            if "\\" in after_colon:
                                return int(after_colon.split("\\")[0])
                            return int(after_colon)
                        except ValueError:
                            continue
                # Fallback: last integer in line
                for part in reversed(parts):
                    try:
                        after_colon = part.split(":")[-1].strip()
                        if "\\" in after_colon:
                            return int(after_colon.split("\\")[0])
                        return int(after_colon)
                    except ValueError:
                        continue

        # Legacy fallback
        for line in block:
            if "streamVolume:" in line:
                try:return int(line.split("streamVolume:")[1].strip())
                except ValueError: pass
        return 0




    def _get_max_volume(self) -> int:
        block = self._get_stream_music_block()
        for line in block:
            if "Max:" in line:
                try: return int(line.split("Max:")[1].split()[0])
                except ValueError: pass
        return 15  # fallback


    def _is_muted(self) -> bool:
        block = self._get_stream_music_block()
        for line in block:
            if "Muted:" in line and "true" in line:
                return True
        return False


    def set_music_volume(self, level: int):
        # Try modern command
        # level is an integer between 0 and max
        out = self._adb(["shell", "media", "volume", "--stream", "3", "--set", str(level)])
        if "not found" in out or "inaccessible" in out:
            out = self._adb(["shell", "cmd", "media_session", "volume", "--stream", "3", "--set", str(level)])
            if "not found" in out or "inaccessible" in out:
                # Fallback to service call audio
                self._adb(["shell", "service", "call", "audio", "10", "i32", "3", "i32", str(level)])



    # -------------------------------
    # Public Methods
    # -------------------------------
    def get_volume_percentage(self) -> int:
        if self._is_muted():
            return 0
        cur = self._get_current_volume()
        maxv = self._get_max_volume()
        return int((cur / maxv) * 100)


    def increase_volume(self, steps: int = 1):
        self._press_key(24, steps)  # KEYCODE_VOLUME_UP


    def decrease_volume(self, steps: int = 1):
        self._press_key(25, steps)  # KEYCODE_VOLUME_DOWN


    def mute(self):
        self._press_key(164, 1)  # KEYCODE_VOLUME_MUTE


    def unmute(self):
        self._press_key(24, 1)  # one Volume Up press
        time.sleep(random.uniform(0.15, 0.4))


    def set_volume_percentage(self, target_percent: int):
        maxv = self._get_max_volume()
        if target_percent <= 0:
            self.mute()
            return

        self.unmute()
        cur = self._get_current_volume()
        target = round((target_percent / 100) * maxv)
        if target == 0 and target_percent > 0: target = 1

        self.set_music_volume(target)


    def random_volume_change(self, do_mute: bool = True):
        """
        Randomly change volume in a human-like way.
        Probability distribution:
        - 100%: 20%
        - 70-90%: 45%
        - 50-70%: 25%
        - 20-50%: 10%
        If do_mute=True: 20% chance to mute.
        If do_mute=False: mute 5%, 100% 5%, rest distributed.
        """
        maxv = self._get_max_volume()

        # Decide mute first
        if do_mute:
            if random.random() < 0.2:  # 20% chance mute
                self.mute()
                return
        else:
            r = random.random()
            if r < 0.05:  # 5% mute
                self.mute()
                return
            elif r < 0.10:  # 5% 100%
                self.set_volume_percentage(100)
                return

        # Weighted distribution for non-mute
        r = random.random()
        if r < 0.20:    # 20% chance
            target_percent = 100
        elif r < 0.65:  # next 45%
            target_percent = random.randint(70, 90)
        elif r < 0.90:  # next 25%
            target_percent = random.randint(50, 70)
        else:           # last 10%
            target_percent = random.randint(20, 50)

        self.set_volume_percentage(target_percent)

    

    def random_volume_change_thread(self, do_mute: bool = True): 
        """ Run random_volume_change in a separate thread. """ 
        t = threading.Thread(target=self.random_volume_change, args=(do_mute,)) 
        t.daemon = True # thread will exit when main program exits 
        t.start() 
        return t


# subprocess.run(["adb", "devices"])

# # Example: Volume Up
# subprocess.run(["adb", "-s", device, "shell", "input", "keyevent", "24"])

# # Example: Volume Down
# subprocess.run(["adb", "-s", device, "shell", "input", "keyevent", "25"])

# # Example: Mute
# subprocess.run(["adb", "-s", device, "shell", "input", "keyevent", "164"])

