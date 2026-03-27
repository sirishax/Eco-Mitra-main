# Eco-Mitra

Eco-Mitra is a sustainability shopping assistant with:

- a Flask backend that analyzes product images
- a static HTML/CSS/JS frontend
- local product tracking stored in JSON

## Project layout

- `ecomitra/backend/analyze_product.py`: Flask API and local static hosting
- `ecomitra/frontend/`: frontend pages and assets
- `ecomitra/requirements.txt`: Python dependencies
- `render.yaml`: Render deployment blueprint

## Before you run it

Set your Gemini API key in PowerShell:

```powershell
$env:GEMINI_API_KEY="your_gemini_api_key"
```

Important: if an old Groq key was committed in the repo history, revoke it.

## Run locally

### Option 1: easiest local run

Run only the Flask app. It serves both the backend and frontend:

```powershell
cd ecomitra
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python backend/analyze_product.py
```

Open:

```text
http://localhost:5000
```

### Option 2: run frontend and backend separately

Backend:

```powershell
cd ecomitra
.venv\Scripts\Activate.ps1
python backend/analyze_product.py
```

Frontend:

```powershell
cd ecomitra/frontend
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

The frontend now automatically talks to `http://localhost:5000` when it detects the local static server.

## Deployment

### Vercel (recommended)

This repo can be deployed directly to Vercel.

1. Import `sirishax/Eco-Mitra` in Vercel.
2. Keep the project root as repository root (`Eco-Mitra/`). Do not set root directory to `ecomitra/`.
3. Add environment variable `GEMINI_API_KEY` in Vercel Project Settings.
4. Deploy.

If Vercel was previously configured with a different root directory, update it and redeploy.

The deployment uses:

- root `vercel.json` for routes and function mapping
- `api/index.py` as the Python serverless entrypoint
- root `requirements.txt` to install backend dependencies
- static frontend files from `ecomitra/frontend/`

#### Optional CLI deploy

```powershell
vercel login
vercel link
vercel env add GEMINI_API_KEY production
vercel --prod
```

If you saw this error before:

`Error: Function Runtimes must have a valid version...`

it is fixed in this repo by removing explicit runtime strings from Vercel config.

After deploy, validate:

- `/health`
- `/api/analyze`
- `/api/tracking`

### Render (legacy)

If you still want Render, this repo also includes `render.yaml`.

### What you need in Render

- a web service from this GitHub repo
- environment variable: `GEMINI_API_KEY`

### Render notes

- Root directory: `ecomitra`
- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn --chdir backend analyze_product:app`

### Important limitation

`product_tracking.json` is file-based storage. On cloud deployments, that data is not guaranteed to persist across restarts unless you attach persistent storage or move tracking data to a database.

### Security note

- Do not commit real keys in `.env`.
- Keep secrets only in Vercel environment variables for production.

