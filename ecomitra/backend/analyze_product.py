import json
import logging
import mimetypes
import os
import re
from datetime import datetime, timedelta
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from google import genai
from google.genai import types
from werkzeug.utils import secure_filename


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
FRONTEND_DIR = PROJECT_DIR / "frontend"
UPLOAD_FOLDER = BASE_DIR / "uploads"
TRACKING_FILE = BASE_DIR / "product_tracking.json"
DEFAULT_IMAGE_PATH = UPLOAD_FOLDER / "photorealistic-water-bottle_23-2151049030.avif"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
CORS(app, resources={r"/api/*": {"origins": "*"}})

UPLOAD_FOLDER.mkdir(exist_ok=True)

_gemini_client = None


def load_local_env():
    for env_path in (PROJECT_DIR / ".env", PROJECT_DIR / ".env.example"):
        if not env_path.exists():
            continue

        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue

            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_local_env()


def load_tracking_data():
    if TRACKING_FILE.exists():
        with TRACKING_FILE.open("r", encoding="utf-8") as file:
            return json.load(file)
    return {"products": []}


def save_tracking_data(data):
    with TRACKING_FILE.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def cleanup_old_data():
    data = load_tracking_data()
    one_week_ago = datetime.now() - timedelta(days=7)
    data["products"] = [
        product
        for product in data["products"]
        if datetime.fromisoformat(product["timestamp"]) > one_week_ago
    ]
    save_tracking_data(data)


def get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to your environment before calling /api/analyze."
            )

        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


def parse_analysis_response(content):
    cleaned_content = content.strip()
    cleaned_content = re.sub(r"^```(?:json)?\s*", "", cleaned_content)
    cleaned_content = re.sub(r"\s*```$", "", cleaned_content)
    return json.loads(cleaned_content)


def get_image_path_from_request():
    if request.method == "POST" and "image" in request.files:
        image = request.files["image"]
        if image and image.filename:
            filename = secure_filename(image.filename)
            image_path = UPLOAD_FOLDER / filename
            image.save(image_path)
            logger.info("Saved uploaded image to %s", image_path)
            return image_path, True
        raise FileNotFoundError("Please upload an image before running analysis.")

    if request.method == "GET" and DEFAULT_IMAGE_PATH.exists():
        return DEFAULT_IMAGE_PATH, False

    raise FileNotFoundError(
        "No image was uploaded and the default sample image was not found."
    )


def analyze_with_gemini(image_path):
    client = get_gemini_client()
    mime_type = mimetypes.guess_type(str(image_path))[0] or "application/octet-stream"
    image_bytes = Path(image_path).read_bytes()

    prompt = """
Analyze this product image and return only valid JSON in this exact format:
{
  "product": "<product name or short description>",
  "material": "<main material(s)>",
  "rating": <number from 1 to 5>,
  "justification": "<short explanation>",
  "alternatives": [
    {
      "name": "<alternative product name>",
      "reason": "<why it is more sustainable>"
    }
  ]
}

Rules:
- Rating 1 means high carbon footprint and unsustainable.
- Rating 5 means low carbon footprint and highly sustainable.
- Suggest 2 to 3 realistic sustainable alternatives when applicable.
- Return JSON only, with no markdown or extra commentary.
""".strip()

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            prompt,
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
        ],
        config=types.GenerateContentConfig(
            temperature=0,
            response_mime_type="application/json",
        ),
    )

    if not response.text:
        raise RuntimeError("Gemini returned an empty response.")

    return parse_analysis_response(response.text)


@app.get("/")
def serve_index():
    return app.send_static_file("home.html")


@app.get("/health")
def healthcheck():
    return jsonify({"status": "ok"})


@app.route("/analyze", methods=["GET", "POST"])
@app.route("/api/analyze", methods=["GET", "POST"])
def analyze_product():
    uploaded_image = False
    image_path = None

    try:
        logger.info("Received request for product analysis")
        image_path, uploaded_image = get_image_path_from_request()
        analysis_data = analyze_with_gemini(image_path)
        logger.info("Analysis result: %s", analysis_data)

        analysis_data["timestamp"] = datetime.now().isoformat()

        tracking_data = load_tracking_data()
        tracking_data["products"].append(analysis_data)
        save_tracking_data(tracking_data)
        cleanup_old_data()

        return jsonify(analysis_data)
    except Exception as error:
        logger.error("Error in analyze_product: %s", error)
        return jsonify({"error": str(error)}), 500
    finally:
        if uploaded_image and image_path and image_path.exists():
            image_path.unlink(missing_ok=True)


@app.route("/tracking", methods=["GET"])
@app.route("/api/tracking", methods=["GET"])
def get_tracking_data():
    try:
        cleanup_old_data()
        return jsonify(load_tracking_data())
    except Exception as error:
        logger.error("Error in get_tracking_data: %s", error)
        return jsonify({"error": str(error)}), 500


if __name__ == "__main__":
    logger.info("Starting Flask server...")
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=True)
