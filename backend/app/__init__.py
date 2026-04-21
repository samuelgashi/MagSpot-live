from flask import Flask
from flask_cors import CORS   # <-- add this import
from .config import Config
from .extensions import jwt
from .routes import register_blueprints
from .repositories.users_repo import init_admin_user
from .db.session import Base, engine, ensure_database_exists, run_migrations
from .models import *
import os

from dotenv import load_dotenv
load_dotenv()

def create_app():
    app = Flask(__name__)

    # Load config
    app.config["SECRET_KEY"] = Config.SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = Config.SQLALCHEMY_DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = Config.SQLALCHEMY_TRACK_MODIFICATIONS
    app.config.from_object(Config)
    
    # Init extensions
    jwt.init_app(app)

    # Enable CORS (allow all origins)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Register blueprints
    register_blueprints(app)

    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    run_migrations()

    init_admin_user()

    return app
