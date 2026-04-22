from flask import Flask
from flask_cors import CORS
from flask_sock import Sock
from .config import Config
from .extensions import jwt
from .routes import register_blueprints
from .repositories.users_repo import init_admin_user
from .db.session import Base, engine, ensure_database_exists, run_migrations
from .models import *
import os
import subprocess

from dotenv import load_dotenv
load_dotenv()

sock = Sock()

def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = Config.SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = Config.SQLALCHEMY_DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = Config.SQLALCHEMY_TRACK_MODIFICATIONS
    app.config.from_object(Config)

    jwt.init_app(app)

    CORS(app, resources={r"/*": {"origins": "*"}})

    register_blueprints(app)

    sock.init_app(app)

    @sock.route('/api/devices/scrcpy-stream')
    def scrcpy_stream(ws):
        from flask import request as flask_request
        device_id = flask_request.args.get('deviceId', '')
        max_size = int(flask_request.args.get('maxSize', 720))
        bit_rate = int(flask_request.args.get('bitRate', 4000000))

        if not device_id:
            ws.close(message='deviceId is required')
            return

        width = max_size
        height = max_size * 2

        proc = subprocess.Popen(
            [
                Config.ADB_PATH, '-s', device_id,
                'exec-out',
                'screenrecord',
                '--output-format=h264',
                f'--size={width}x{height}',
                f'--bit-rate={bit_rate}',
                '-',
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )

        try:
            while True:
                chunk = proc.stdout.read(65536)
                if not chunk:
                    break
                ws.send(chunk)
        except Exception:
            pass
        finally:
            try:
                proc.terminate()
                proc.wait(timeout=3)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

    ensure_database_exists()
    Base.metadata.create_all(bind=engine)
    run_migrations()

    init_admin_user()

    return app
