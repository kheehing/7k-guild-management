# OCR Service for Game Capture

Python-based OCR service using Tesseract OCR for text extraction from game screenshots with multi-language support.

## Prerequisites

### 1. Install Tesseract OCR with Language Packs

**Download and Install:**
1. Go to: https://github.com/UB-Mannheim/tesseract/wiki
2. Download: `tesseract-ocr-w64-setup-5.3.3.20231005.exe` (or latest version)
3. Run the installer
4. **IMPORTANT**: During installation:
   - ✅ Check "Add to PATH"
   - ✅ Under "Choose Components", expand "Additional language data"
   - ✅ Select these languages:
     - **English** (eng) - Pre-selected
     - **Chinese (Simplified)** (chi_sim)
     - **Chinese (Traditional)** (chi_tra)
     - **Thai** (tha)
   - Default install path: `C:\Program Files\Tesseract-OCR\`

**Verify Installation:**
```powershell
tesseract --version
tesseract --list-langs
```

You should see:
```
List of available languages in "C:\Program Files\Tesseract-OCR\tessdata/" (5):
chi_sim
chi_tra
eng
osd
tha
```

### 2. Python 3.9+ Required

Check your Python version:
```powershell
python --version
```

## Setup

1. **Install Python dependencies:**
   ```powershell
   cd python
   pip install -r requirements.txt
   ```

   This installs:
   - flask (Web framework)
   - flask-cors (Cross-origin support)
   - opencv-python-headless (Image processing)
   - pillow (Image handling)
   - pytesseract (Tesseract wrapper)
   - numpy (Numerical operations)

## Usage

**Start the OCR service:**
```powershell
cd python
python ocr_service.py
```

You should see:
```
Starting OCR Service...
Found Tesseract at: C:\Program Files\Tesseract-OCR\tesseract.exe
Tesseract OCR initialized
 * Running on http://127.0.0.1:5000
```

## Troubleshooting

### "Tesseract not found" Error

**Option 1: Add to PATH manually**
1. Search Windows for "Environment Variables"
2. Edit "Path" in System Variables
3. Add: `C:\Program Files\Tesseract-OCR`
4. Restart terminal

**Option 2: Set path in code**
Edit `ocr_service.py` line 15-20, uncomment and set:
```python
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
```

### Missing Language Data

If you get errors about missing languages:
1. Re-run Tesseract installer
2. Choose "Modify" installation
3. Ensure language packs are selected
4. Restart the service

### Low OCR Accuracy

Current preprocessing includes:
- 2x upscaling for better character recognition
- CLAHE contrast enhancement
- Sharpening filter
- Bilateral noise reduction
- Multi-language support (English, Chinese, Thai)
- Fuzzy matching to guild member database (65% similarity)

## API Endpoints

### POST /extract
Extract player data from game screenshot

**Request:**
```json
{
  "image": "data:image/png;base64,...",
  "captureType": "castle-rush"
}
```

**Response:**
```json
{
  "success": true,
  "players": [
    {"playerName": "PlayerOne", "score": 1234567},
    {"playerName": "PlayerTwo", "score": 987654}
  ],
  "count": 2
}
```

### GET /health
Check service status

## Troubleshooting

If you get "tesseract not found" error:
1. Verify Tesseract is installed: `tesseract --version`
2. If not in PATH, edit `ocr_service.py` line 13:
   ```python
   pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
   ```
