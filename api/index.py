import sys
from pathlib import Path

# Add backend directory to Python path
backend_dir = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

# Import and expose the FastAPI app
from server import app

# This is what Vercel looks for
__all__ = ['app']
