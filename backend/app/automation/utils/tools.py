# import cv2
import random
import math, time
import numpy as np
from app.config  import Config
from appium import webdriver as appium_webdriver 
from skimage.metrics import structural_similarity as ssim
from PIL import Image, ImageDraw
import imagehash

######################################################################
######  Compare Image Similarity
######################################################################

def crop_to_circle(input_path, output_path):
    """Takes a rectangular image and crops it into a circle with a black background."""
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    # Circle diameter = min(width, height)
    diameter = min(width, height)
    # Center crop to a square
    left = (width - diameter) // 2
    top = (height - diameter) // 2
    right = left + diameter
    bottom = top + diameter
    img = img.crop((left, top, right, bottom))
    # Create circular mask
    mask = Image.new("L", (diameter, diameter), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, diameter, diameter), fill=255)
    # Create black background instead of transparent
    circular_img = Image.new("RGB", (diameter, diameter), (0, 0, 0))
    # Paste the circular image using mask
    circular_img.paste(img, (0, 0), mask)
    circular_img.save(output_path)
    return output_path


def load_grayscale(image_path, size=(256, 256)):
    img = Image.open(image_path).convert("L").resize(size)
    return np.array(img)

def compute_ssim(img1, img2):
    score, _ = ssim(img1, img2, full=True)
    return score

def compute_phash_similarity(img1_path, img2_path):
    img1 = Image.open(img1_path)
    img2 = Image.open(img2_path)
    hash1 = imagehash.phash(img1)
    hash2 = imagehash.phash(img2)
    # Hamming distance → similarity
    max_bits = len(hash1.hash) ** 2
    distance = hash1 - hash2
    similarity = 1 - (distance / max_bits)
    return similarity


def compare_images(img1_path, img2_path):
    img1 = load_grayscale(img1_path)
    img2 = load_grayscale(img2_path)
    ssim_score = compute_ssim(img1, img2)
    phash_score = compute_phash_similarity(img1_path, img2_path)
    # Weighted fusion (important)
    final_score = (0.6 * ssim_score) + (0.4 * phash_score)
    return round(final_score, 4)


######################################################################
######  Generate Skipping Rates
######################################################################

def generate_skipping_rates(
    count: int = 8,
    low_range: list = [42, 58],
    high_range: list = [100, 120],
    high_count: int = 1,
    avg_range: list = [55, 60]
):
    """
    Generate 'count' numbers with constraints:
    - Most numbers from low_range
    - 'high_count' numbers from high_range
    - Average must fall within avg_range
    """

    while True:
        # Step 1: Pick random indices for high numbers
        high_indices = random.sample(range(count), high_count)

        # Step 2: Generate numbers in low range
        nums = random.sample(range(low_range[0], low_range[1]), count)

        # Step 3: Replace selected positions with high range numbers
        for idx in high_indices:
            nums[idx] = random.randint(high_range[0], high_range[1])

        # Step 4: Check average constraint
        avg = sum(nums) / count
        if avg_range[0] <= avg <= avg_range[1]:
            return nums, avg
  



def tap_random_in_element(driver: appium_webdriver, element):
    """
    Tap at a random point inside the given element.
    The point is chosen uniformly within a circle inscribed in the element bounds.
    """
    # get element location and size
    loc = element.location
    size = element.size

    center_x = loc['x'] + size['width'] / 2
    center_y = loc['y'] + size['height'] / 2

    # radius is half of the smaller dimension (to stay inside element)
    radius = min(size['width'], size['height']) / 2

    # random polar coordinates inside circle
    r = radius * math.sqrt(random.random())  # uniform distribution
    theta = random.uniform(0, 2 * math.pi)

    x = int(center_x + r * math.cos(theta))
    y = int(center_y + r * math.sin(theta))

    driver.tap([(x, y)])
    time.sleep(0.5)  # small delay

    return (x, y)  # return coords for debugging/logging



BASE_WIDTH = 1080
BASE_HEIGHT = 2280

def random_point_in_circle(center_x, center_y, radius, device_width, device_height, isOverrideResolution=True):
    """
    Generate a random point inside a circle, scaled to device resolution.
    :param isOverrideResolution: True = use BASE coordinates scaling, False = use physical coordinates
    """
    # Scale center coordinates from BASE to device
    if isOverrideResolution:
        center_x = center_x / BASE_WIDTH * device_width
        center_y = center_y / BASE_HEIGHT * device_height
    # If physical device, center is already in physical coordinates
    # but we still need to scale radius relative to device size
    scale_factor = min(device_width / BASE_WIDTH, device_height / BASE_HEIGHT)
    radius *= scale_factor * 0.99  # shrink slightly for safety

    r = radius * math.sqrt(random.random())
    theta = random.uniform(0, 2 * math.pi)

    x = center_x + r * math.cos(theta)
    y = center_y + r * math.sin(theta)

    return int(x), int(y)


# def random_point_in_circle(center_x, center_y, radius, device_width, device_height):
#     """
#     Generate random point inside circle (scaled to device resolution).
#     Shrinks radius by 1% to stay inside boundaries.
#     """
#     # shrink radius by 1%
#     radius = radius * 0.99

#     # random polar coordinates
#     r = radius * math.sqrt(random.random())  # uniform distribution inside circle
#     theta = random.uniform(0, 2 * math.pi)

#     # point relative to center
#     x = center_x + r * math.cos(theta)
#     y = center_y + r * math.sin(theta)

#     # scale to current resolution
#     scaled_x = int(x / BASE_WIDTH * device_width)
#     scaled_y = int(y / BASE_HEIGHT * device_height)

#     return scaled_x, scaled_y




def random_point_in_rectangle(left, top, right, bottom, device_width, device_height):
    """
    Generate random point inside rectangle defined by (left, top) and (right, bottom).
    Scales coordinates from baseline (1080x2280) to current device resolution.
    """
    # shrink boundaries by 1% to stay inside
    width = right - left
    height = bottom - top
    shrink_x = width * 0.01
    shrink_y = height * 0.01

    # random point inside shrunken rectangle
    x = random.uniform(left + shrink_x, right - shrink_x)
    y = random.uniform(top + shrink_y, bottom - shrink_y)

    # scale to current resolution
    scaled_x = int(x / BASE_WIDTH * device_width)
    scaled_y = int(y / BASE_HEIGHT * device_height)

    return scaled_x, scaled_y


def _get_btn_coord(name, device_width, device_height, isOverrideResolution=False):
    if name not in Config.BUTTONS_CENTERS:
        raise ValueError(f"Button '{name}' not found in BUTTON_CENTERS")

    center_key = "base" if isOverrideResolution else "physical"
    center_x, center_y = Config.BUTTONS_CENTERS[name][center_key]
    radius = Config.BUTTONS_CENTERS[name]["radius"]
    return random_point_in_circle(center_x, center_y, radius, device_width, device_height, isOverrideResolution)



def get_element_coord(element, device_width, device_height, isOverrideResolution=False,  shape="rect", scale=0.7):

    """
    Calculate a safe tap coordinate inside a UI element.

    - Purpose:
      * Prevents edge taps by shrinking the clickable area into a circle inside the element.
      * Returns a random point within this safe zone, scaled to device resolution.

    - Flow:
      * Validate element:
        - Ensure element is provided, else raise Exception.
      * Extract geometry:
        - Get element bounds (x1, y1, x2, y2).
        - Compute original center (center_x, center_y).
        - Compute inscribed circle radius = min(width, height) / 2.
      * Apply scaling:
        - Shrink radius by factor `scale` → new_radius.
        - Center remains unchanged (new_center_x, new_center_y).
      * Compute safe bounds:
        - safe_left   = new_center_x - new_radius
        - safe_right  = new_center_x + new_radius
        - safe_top    = new_center_y - new_radius
        - safe_bottom = new_center_y + new_radius
      * Package geometry:
        - Store original center, radius, scaled radius, and safe bounds in `data`.
      * Generate tap point:
        - Call `random_point_in_circle` with new center and new radius.
        - Scale coordinates to device resolution if `isOverrideResolution=True`.
        - Return final (x, y) tap coordinate.
    """

    if element:
        elem_loc = element.location
        elem_siz = element.size

        # Original rectangle bounds
        x1 = elem_loc['x']
        y1 = elem_loc['y']
        x2 = x1 + elem_siz['width']
        y2 = y1 + elem_siz['height']

        # Original center
        center_x = (x1 + x2) / 2
        center_y = (y1 + y2) / 2

        # Original inscribed circle radius
        radius = min(elem_siz['width'], elem_siz['height']) / 2

        # Scaled radius
        new_radius = radius * scale

        # New circle is centered at the same point,
        # but its edges are inset from the rectangle edges
        new_center_x = center_x
        new_center_y = center_y

        # For clarity, also compute the safe bounds of the circle
        safe_left   = new_center_x - new_radius
        safe_right  = new_center_x + new_radius
        safe_top    = new_center_y - new_radius
        safe_bottom = new_center_y + new_radius

        data = {
            "size": elem_siz,
            "center_x": center_x,
            "center_y": center_y,
            "radius": radius,
            "new_center_x": new_center_x,
            "new_center_y": new_center_y,
            "new_radius": new_radius,
            "safe_bounds": (safe_left, safe_top, safe_right, safe_bottom)
        }

        r = new_radius * math.sqrt(random.random())
        theta = random.uniform(0, 2 * math.pi)
        x = new_center_x + r * math.cos(theta)
        y = new_center_y + r * math.sin(theta)

        if x is None or y is None: 
            raise Exception(f"Invalid coordinates or element [{x}, {y}]")
        
        return int(x), int(y)

    else: raise Exception("Element To Be Clicked Not Provided")



def get_shuffle_btn_coord(device_width, device_height, isOverrideResolution=False):
    return _get_btn_coord("shuffle", device_width, device_height, isOverrideResolution)

def get_loop_btn_coord(device_width, device_height, isOverrideResolution=False):
    return _get_btn_coord("loop", device_width, device_height, isOverrideResolution)

def get_next_btn_coord(device_width, device_height, isOverrideResolution=False):
    return _get_btn_coord("next", device_width, device_height, isOverrideResolution)

def get_back_btn_coord(device_width, device_height, isOverrideResolution=False):
    return _get_btn_coord("back", device_width, device_height, isOverrideResolution)

def get_play_btn_coord(device_width, device_height, isOverrideResolution=False):
    return _get_btn_coord("play", device_width, device_height, isOverrideResolution)

def get_like1_coord(device_width, device_height, isOverrideResolution=False):
    return _get_btn_coord("like", device_width, device_height, isOverrideResolution)

def get_dislike_btn_coord(device_width, device_height, isOverrideResolution=False):
    return _get_btn_coord("dislike", device_width, device_height, isOverrideResolution)

# def get_shuffle_btn_coord(device_width, device_height):
#     center_x, center_y = 75, 1760  # approx center from given coords
#     radius = 60  # half of width/height (120/2)
#     return random_point_in_circle(center_x, center_y, radius, device_width, device_height)


# def get_back_btn_coord(device_width, device_height):
#     center_x, center_y = 280, 1760
#     radius = 70  # half of 140
#     return random_point_in_circle(center_x, center_y, radius, device_width, device_height)

# def get_play_btn_coord(device_width, device_height):
#     center_x, center_y = 535, 1770
#     radius = 90  # half of 180
#     return random_point_in_circle(center_x, center_y, radius, device_width, device_height)

# def get_next_btn_coord(device_width, device_height):
#     center_x, center_y = 785, 1760
#     radius = 70  # half of 140
#     return random_point_in_circle(center_x, center_y, radius, device_width, device_height)

# def get_loop_btn_coord(device_width, device_height):
#     center_x, center_y = 990, 1760
#     radius = 60  # half of 120
#     return random_point_in_circle(center_x, center_y, radius, device_width, device_height)


# def get_like1_coord(device_width, device_height):
#     center_x, center_y = 130, 1465   # approx center from given coords
#     radius = 40                      # half of width/height (80/2)
#     return random_point_in_circle(center_x, center_y, radius, device_width, device_height)


# def get_dislike_btn_coord(device_width, device_height):
#     center_x, center_y = 290, 1465   # approx center from given coords
#     radius = 40                      # half of width/height (80/2)
#     return random_point_in_circle(center_x, center_y, radius, device_width, device_height)

def get_random_click_coord(device_width, device_height):
    # Rectangle defined by your coordinates
    left, top = 660, 1250
    right, bottom = 1000, 1350
    return random_point_in_rectangle(left, top, right, bottom, device_width, device_height)


