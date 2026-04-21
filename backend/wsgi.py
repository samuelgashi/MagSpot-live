import os
from app import create_app
from app.config import Config
import sys

# Force UTF-8 output on Windows
if os.name == "nt":
    sys.stdout.reconfigure(encoding="utf-8")


app = create_app()

if __name__ == "__main__":

    port = int(Config.BACKEND_PORT)
    app.run(host="0.0.0.0", port=port)
