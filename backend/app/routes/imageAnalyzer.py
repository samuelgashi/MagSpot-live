
import os
import json
import base64
import uuid
import requests
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont
from google import genai
from google.genai import types
from app.config import Config
from app.utils.gemini_ import geminiAnalyzeImageWeb, geminiAnalyzeImageAPI, draw_bounding_boxes

app = Flask(__name__)
CORS(app)



@app.route('/v1/analyze', methods=['POST'])
def analyze_image():
    """
    Endpoint 1: Analyze image from website
    Accepts JSON with image_url or base64_image and prompt
    """
    try:
        data = request.get_json()
        if not data: return jsonify({"error": "Missing request body"}), 400
        
        image_url = data.get('image_url')
        prompt = data.get('prompt', 'Buttons')
        base64_image = data.get('base64_image')
        highlight = data.get('highlight', False)
        model = data.get('model', Config.GEMINI_IMAGE_ANALYZE_MODEL)
        physicalResolution = request.form.get('physicalResolution', Config.IMAGE_PHYSICAL_RESOLUTION)
        overrideResolution = request.form.get('overrideResolution', Config.IMAGE_OVERRIDE_RESOLUTION)
        SYSTEM_PROMPT = request.form.get(
            'system_prompt', Config.GEMINI_IMAGE_ANALYZE_PROMPT(physicalResolution, overrideResolution)
        )
        if not prompt: return jsonify({"error": "Missing 'prompt' field"}), 400
        
        image_data, mime_type = None, 'image/png'
        if image_url:
            response = requests.get(image_url)
            if response.status_code != 200: return jsonify({"error": "Failed to fetch image from URL"}), 400
            image_data = base64.b64encode(response.content).decode('utf-8')
            mime_type = response.headers.get('Content-Type', 'image/png')

        elif base64_image:
            if base64_image.startswith('data:'):  base64_image = base64_image.split(',')[1]
            image_data = base64_image
        else: return jsonify({"error": "Missing 'image_url' or 'base64_image' field"}), 400
        
        result_data = geminiAnalyzeImageWeb(image_data, mime_type, SYSTEM_PROMPT, prompt, model)
        highlighted_image = draw_bounding_boxes(image_data, result_data) if highlight else None

        return jsonify({
            "status": "success",
            "model": model,
            "data": result_data,
            "highlighted_image": highlighted_image
        })
        
    except Exception as e: return jsonify({"error": str(e)}), 500





@app.route('/v1/detect', methods=['POST'])
def detect_elements():
    """
    Endpoint 2: For curl file upload
    Accepts multipart form data with 'image' and 'prompt' fields
    """
    try:
        prompt = request.form.get('prompt')
        physicalResolution = request.form.get('physicalResolution', "")
        overrideResolution = request.form.get('overrideResolution', "")
        SYSTEM_PROMPT = request.form.get(
            'system_prompt', Config.GEMINI_IMAGE_ANALYZE_PROMPT(physicalResolution, overrideResolution)
        )
        model = request.form.get('model', 'gemini-3-flash-preview')  # Configurable model
        # temperature = request.form.get('temperature')  # Model temperature
        # max_output_tokens = request.form.get('max_output_tokens')  # Max output tokens
        highlight = request.form.get('highlight', True)  # Whether to generate highlighted image
        file = request.files.get('image')
        if not file or not (prompt or SYSTEM_PROMPT): return jsonify({"error": "Missing required 'image' or 'prompt' field"}), 400
        file_data = file.read()
    
        result_data = geminiAnalyzeImageAPI(file, file_data, SYSTEM_PROMPT, prompt, model)
        highlighted_image = draw_bounding_boxes(file_data, result_data) if highlight else None
        
        return jsonify({
            "status": "success",
            "model": model,
            "data": result_data,
            "highlighted_image": highlighted_image
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
