import cv2
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import pytesseract
from difflib import SequenceMatcher
import re
import os

app = Flask(__name__)
CORS(app)

# Try to find Tesseract automatically
tesseract_paths = [
    r'C:\Program Files\Tesseract-OCR\tesseract.exe',
    r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
    r'C:\Tesseract-OCR\tesseract.exe',
]

tesseract_found = False
for path in tesseract_paths:
    if os.path.exists(path):
        pytesseract.pytesseract.tesseract_cmd = path
        tesseract_found = True
        print(f"Found Tesseract at: {path}")
        break

if not tesseract_found:
    print("WARNING: Tesseract not found. Please install Tesseract OCR:")
    print("Download from: https://github.com/UB-Mannheim/tesseract/wiki")
    print("Or set the path manually in ocr_service.py")

def decode_base64_image(base64_string):
    """Convert base64 string to numpy array (OpenCV image)"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    img_bytes = base64.b64decode(base64_string)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

def preprocess_image(img):
    """Enhance image for better OCR accuracy"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Upscale 2x for better character recognition
    height, width = gray.shape
    upscaled = cv2.resize(gray, (width * 2, height * 2), interpolation=cv2.INTER_CUBIC)
    
    # Enhance contrast with CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8,8))
    enhanced = clahe.apply(upscaled)
    
    # Sharpen
    kernel = np.array([[0, -1, 0],
                       [-1, 5, -1],
                       [0, -1, 0]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    
    # Bilateral filter to reduce noise while keeping edges
    filtered = cv2.bilateralFilter(sharpened, 5, 50, 50)
    
    # Apply OTSU threshold
    _, binary = cv2.threshold(filtered, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    return binary

def extract_player_data(img, member_names=None):
    """Extract player names and scores using Tesseract OCR"""
    
    processed = preprocess_image(img)
    
    # Perform OCR with bounding box information - support multiple languages
    ocr_data = pytesseract.image_to_data(
        processed,
        output_type=pytesseract.Output.DICT,
        config='--psm 11 --oem 3 -l eng+chi_sim+chi_tra+tha -c preserve_interword_spaces=1',
        lang='eng+chi_sim+chi_tra+tha'
    )
    
    print(f"[OCR] Found {len(ocr_data['text'])} text elements")
    
    # Parse results into structured data
    text_elements = []
    for i in range(len(ocr_data['text'])):
        text = ocr_data['text'][i].strip()
        conf = float(ocr_data['conf'][i])
        
        if not text or conf < 30:  # Lower threshold
            continue
        
        x = ocr_data['left'][i]
        y = ocr_data['top'][i]
        w = ocr_data['width'][i]
        h = ocr_data['height'][i]
        
        center_y = y + h / 2
        center_x = x + w / 2
        
        text_elements.append({
            'text': text,
            'confidence': conf,
            'bbox': {'x0': x, 'y0': y, 'x1': x + w, 'y1': y + h},
            'center_x': center_x,
            'center_y': center_y,
        })
    
    print(f"[DEBUG] Valid text elements: {[(t['text'], int(t['confidence'])) for t in text_elements]}")
    
    # Separate scores and names
    scores = []
    names = []
    
    for elem in text_elements:
        text = elem['text']
        
        # Check if it's a score (6-7 digits, may have commas)
        clean_text = text.replace(',', '')
        if clean_text.isdigit() and len(clean_text) >= 5:
            score_value = int(clean_text)
            if 10000 <= score_value <= 10000000:
                scores.append({
                    'value': score_value,
                    'center_y': elem['center_y'],
                    'center_x': elem['center_x'],
                    'bbox': elem['bbox']
                })
                print(f"[SCORE] Found: {score_value} at y={elem['center_y']:.1f}")
                continue
        
        # Check if it's a potential player name
        if len(text) >= 3 and re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', text):
            lower = text.lower()
            blacklist = ['guild', 'clan', 'team', 'level', 'rank', 'score', 'total', 
                        'damage', 'apothoesis', 'ap0thoesis', 'apthoesis', 'castle', 'rush',
                        'member', 'personal', 'rankings', 'ranking', 'previous', 'enter',
                        'strategy', 'shop', 'rewards', 'help', 'immortal', 'points', 'best',
                        'has', 'obtained', 'kings']
            
            if lower not in blacklist:
                names.append({
                    'text': text,
                    'center_y': elem['center_y'],
                    'center_x': elem['center_x'],
                    'bbox': elem['bbox'],
                    'confidence': elem['confidence']
                })
                print(f"[NAME] Found: {text} at y={elem['center_y']:.1f}")
        
        # Also check for names with Chinese/Thai characters (at least 2 chars)
        elif len(text) >= 2 and not text.isdigit():
            # Check if contains non-ASCII (Chinese, Thai, etc.)
            has_non_ascii = any(ord(char) > 127 for char in text)
            if has_non_ascii:
                lower = text.lower()
                blacklist_check = any(bl in lower for bl in ['guild', 'clan', 'team', 'rank', 'score'])
                if not blacklist_check:
                    names.append({
                        'text': text,
                        'center_y': elem['center_y'],
                        'center_x': elem['center_x'],
                        'bbox': elem['bbox'],
                        'confidence': elem['confidence']
                    })
                    print(f"[NAME] Found (non-ASCII): {text} at y={elem['center_y']:.1f}")
    
    # Fuzzy match OCR names to database member names
    if member_names:
        matched_names = []
        for name_obj in names:
            ocr_name = name_obj['text']
            best_match = None
            best_ratio = 0
            
            for db_name in member_names:
                ratio = SequenceMatcher(None, ocr_name.lower(), db_name.lower()).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match = db_name
            
            # Use database name if similarity > 65% (more lenient)
            if best_match and best_ratio > 0.65:
                matched_names.append({
                    **name_obj,
                    'text': best_match,
                    'ocr_text': ocr_name,
                    'match_ratio': best_ratio
                })
                print(f"[MATCH] OCR '{ocr_name}' -> DB '{best_match}' (similarity: {best_ratio:.2%})")
            else:
                matched_names.append(name_obj)
        
        names = matched_names
    
    # Match names to scores
    player_data = []
    used_names = set()
    
    for score in scores:
        candidates = []
        
        for name in names:
            if name['text'] in used_names:
                continue
            
            vertical_dist = abs(name['center_y'] - score['center_y'])
            is_left = name['center_x'] < score['center_x']
            
            if vertical_dist < 100 and is_left:
                distance_score = max(0, 100 - vertical_dist)
                confidence_score = name['confidence']
                match_score = (distance_score * 0.7) + (confidence_score * 0.3)
                
                candidates.append({
                    'name': name['text'],
                    'score': match_score,
                    'name_obj': name,
                    'distance': vertical_dist
                })
                print(f"[CANDIDATE] {name['text']} for {score['value']}: dist={vertical_dist:.1f}, conf={name['confidence']:.1f}, match={match_score:.1f}")
        
        if candidates:
            best = max(candidates, key=lambda x: x['score'])
            player_data.append({
                'playerName': best['name'],
                'score': score['value']
            })
            used_names.add(best['name'])
            print(f"[MATCH] {best['name']} -> {score['value']} (dist={best['distance']:.1f})")
    
    player_data.sort(key=lambda x: x['score'], reverse=True)
    
    print(f"[RESULT] Extracted {len(player_data)} players")
    return player_data

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

@app.route('/extract', methods=['POST'])
def extract():
    try:
        try:
            pytesseract.get_tesseract_version()
        except Exception as e:
            return jsonify({
                'error': 'Tesseract OCR not found. Please install Tesseract from https://github.com/UB-Mannheim/tesseract/wiki',
                'details': str(e)
            }), 500
        
        data = request.json
        image_data = data.get('image')
        member_names = data.get('memberNames', None)
        capture_type = data.get('captureType', 'castle-rush')
        
        if not image_data:
            return jsonify({'error': 'No image provided'}), 400
        
        img = decode_base64_image(image_data)
        if img is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # Handle castle name extraction
        if capture_type == 'castle-name':
            processed = preprocess_image(img)
            ocr_data = pytesseract.image_to_data(
                processed,
                output_type=pytesseract.Output.DICT,
                config='--psm 7 --oem 3 -l eng+chi_sim+chi_tra+tha',
                lang='eng+chi_sim+chi_tra+tha'
            )
            
            castle_name = ''
            for i, text in enumerate(ocr_data['text']):
                if text.strip() and float(ocr_data['conf'][i]) > 50:
                    castle_name = text.strip()
                    break
            
            return jsonify({
                'success': True,
                'castle_name': castle_name
            })
        
        # Handle player data extraction
        players = extract_player_data(img, member_names)
        
        return jsonify({
            'success': True,
            'players': players,
            'count': len(players)
        })
    
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'type': type(e).__name__}), 500

if __name__ == '__main__':
    print("Starting OCR Service...")
    print("Tesseract OCR initialized")
    app.run(host='127.0.0.1', port=5000, debug=True)
