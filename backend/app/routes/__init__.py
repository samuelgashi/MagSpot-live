# from .auth import auth_bp
from flask import Blueprint

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

api_bp = Blueprint("api", __name__, url_prefix='/api')
yt_music_api = Blueprint("yt_music_api", __name__, url_prefix='/api/yt_music')
google_chrome_api = Blueprint("google_chrome_api", __name__, url_prefix='/api/google_chrome')
youtube_api = Blueprint("youtube_api", __name__, url_prefix='/api/youtube_api')


from app.routes import admin
from app.routes import tasks
from app.routes import devices
from app.routes import task_templates
from app.routes import api
from app.routes import api_keys
from app.routes import tunnels
from app.routes import auth
from app.routes.yt_music import search_by_artist
from app.routes.yt_music import stream_by_library
from app.routes.yt_music import stream_by_playlist
from app.routes.chrome import google_search
from app.routes.youtube import youtube_shorts
from app.routes.yt_music import tasks

def register_blueprints(app):
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(yt_music_api)
    app.register_blueprint(youtube_api)
    app.register_blueprint(google_chrome_api)
