from app import create_app
from flask_cors import CORS

app = create_app()
CORS(app)  # allow all origins


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(9786), debug=False, use_reloader=False)
