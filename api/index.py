import sys
from pathlib import Path

# Add the root and backend directories to the Python search path
# so Vercel can find and run your existing backend code.
ROOT_DIR = Path(__file__).parent.parent
sys.path.append(str(ROOT_DIR))
sys.path.append(str(ROOT_DIR / "backend"))

# Expose the FastAPI app for Vercel's Python Serverless Runtime
from backend.server import app
