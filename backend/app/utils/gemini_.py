
import json
import uuid
import base64
import os, io
from google import genai
from flask_cors import CORS
from datetime import datetime
from google.genai import types
from flask import Flask, request, jsonify
from PIL import Image, ImageDraw, ImageFont
from app.config import Config


# Load environment variables
GEMINI_API_KEY = Config.GEMINI_API_KEY


OBJECTION_OUTPUT_FORMAT = {
    "community": types.Schema(
        type=types.Type.OBJECT,
        properties={
            "Like": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "Dislike": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "Message": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "Save": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "Share": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
        },
    ),
    "controller": types.Schema(
        type=types.Type.OBJECT,
        properties={
            "circle": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "line": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "Shuffle": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "Previous": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "Play": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "Next": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
            "Repeat": types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(type=types.Type.NUMBER)
            ),
        },
    ),
}




def draw_bounding_boxes(image_data, detections, output_filename=None):
    """
    Draw bounding boxes on image and save it.
    Args:
        image_data: Base64 encoded image or image bytes
        detections: Dictionary containing bounding boxes
        output_filename: Optional filename, otherwise generates one
    Returns: Path to saved image
    """
    try:
        if isinstance(image_data, str) and not image_data.startswith('data:'): img = Image.open(io.BytesIO(base64.b64decode(image_data)))
        elif isinstance(image_data, str) and image_data.startswith('data:'): img = Image.open(io.BytesIO(base64.b64decode(image_data.split(',')[1])))
        else: img = Image.open(io.BytesIO(image_data))
        
        if img.mode != 'RGB': img = img.convert('RGB')
        draw = ImageDraw.Draw(img)
        colors = {
            'community': (0, 255, 0),    # Green
            'controller': (255, 0, 0),    # Red
            'circle': (0, 0, 255),       # Blue
            'line': (255, 165, 0),       # Orange
        }
        for category, elements in detections.items():
            if not elements or (isinstance(elements, list) and None in elements): continue
            
            if isinstance(elements, dict):
                for element_name, bbox in elements.items():
                    if bbox is None or len(bbox) != 4: continue

                    # Get color for this category
                    color = colors.get(category, (255, 255, 255))
                    if element_name in colors: color = colors[element_name]
                    
                    # Draw rectangle
                    x1, y1, x2, y2 = bbox
                    draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
                    
                    # Add label
                    label = f"{element_name}"
                    try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20)
                    except: font = ImageFont.load_default()
                    
                    # Draw text with background
                    text_bbox = draw.textbbox((x1, y1), label, font=font)
                    draw.rectangle(text_bbox, fill=color)
                    draw.text((x1, y1), label, fill=(0, 0, 0), font=font)
        
        # Generate output filename if not provided
        if output_filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"highlighted_{timestamp}_{uuid.uuid4().hex[:8]}.jpg"
        
        output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), output_filename)
        img.save(output_path, 'JPEG', quality=90)
        return output_filename
        
    except Exception as e:
        print(f"[DEBUG] Error drawing bounding boxes: {e}")
        return None




def geminiAnalyzeImageWeb(image_data=None, mime_type=None, system_prompt="", prompt="Buttons", model="gemini-3-flash-preview"):
    client = genai.Client(api_key=GEMINI_API_KEY)
    system_instruction = system_prompt or f'''
    Identify bounding boxes for: "{prompt}".
    Return JSON with normalized [ymin, xmin, ymax, xmax] (0-1000).
    '''
    response = client.models.generate_content(
        model=model,
        contents=[types.Content(parts=[ types.Part(text=system_instruction), types.Part(inline_data=types.Blob(mime_type=mime_type, data=base64.b64decode(image_data))),],),],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=types.Schema(
                type=types.Type.OBJECT,
                properties=OBJECTION_OUTPUT_FORMAT,
                required=["community", "controller"],
            ),
        ),
    )
    result_data = json.loads(response.text.strip())
    return result_data





def geminiAnalyzeImageAPI(file=None, file_data=None, system_prompt="", prompt="Buttons", model="gemini-3-flash-preview"):
    client = genai.Client(api_key=GEMINI_API_KEY)
    system_instruction = system_prompt or f'''
    Identify bounding boxes for: "{prompt}".
    Return JSON with normalized [ymin, xmin, ymax, xmax] (0-1000).
    '''
    response = client.models.generate_content(
        model=model,
        contents=[types.Content(parts=[types.Part(text=system_instruction),types.Part(inline_data=types.Blob( mime_type=file.mimetype,  data=file_data)),],),],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=types.Schema(
                type=types.Type.OBJECT,
                properties=OBJECTION_OUTPUT_FORMAT,
                required=["community", "controller"],
            ),
        ),
    )
    result_data = json.loads(response.text.strip())
    return result_data