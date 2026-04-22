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

    def _find_annex_b_start_code(data: bytearray, start: int):
        """Return (position, start_code_length) or (-1, 0)."""
        i = start
        lim = len(data) - 3
        while i <= lim:
            if data[i] == 0 and data[i + 1] == 0:
                if data[i + 2] == 0 and i < lim and data[i + 3] == 1:
                    return i, 4
                if data[i + 2] == 1:
                    return i, 3
            i += 1
        return -1, 0

    @sock.route('/api/devices/scrcpy-stream')
    def scrcpy_stream(ws):
        from flask import request as flask_request
        device_id = flask_request.args.get('deviceId', '')
        max_size = int(flask_request.args.get('maxSize', 720))
        bit_rate = int(flask_request.args.get('bitRate', 4000000))

        if not device_id:
            return

        width = max_size
        height = max_size * 2

        proc = subprocess.Popen(
            [
                Config.ADB_PATH, '-s', device_id,
                'exec-out', 'screenrecord',
                '--output-format=h264',
                f'--size={width}x{height}',
                f'--bit-rate={bit_rate}',
                '-',
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )

        try:
            buf = bytearray()
            prev_sc_pos = None
            prev_sc_len = 0

            while True:
                chunk = proc.stdout.read(4096)
                if not chunk:
                    # EOF: emit any remaining NAL unit
                    if prev_sc_pos is not None and len(buf) > prev_sc_len:
                        ws.send(bytes(buf))
                    break

                old_len = len(buf)
                buf.extend(chunk)

                # Start searching slightly before the new data to catch
                # start codes that span the previous/new chunk boundary.
                search_start = max(0, old_len - 3)

                while True:
                    pos, sc_len = _find_annex_b_start_code(buf, search_start)
                    if pos < 0:
                        break

                    if prev_sc_pos is not None:
                        # Emit the NAL unit that ended at `pos`
                        nal = bytes(buf[prev_sc_pos:pos])
                        if len(nal) > prev_sc_len:
                            ws.send(nal)
                        # Trim the buffer to start at the new NAL's start code
                        buf = bytearray(buf[pos:])
                        prev_sc_pos = 0
                        prev_sc_len = sc_len
                        search_start = sc_len
                    else:
                        # First start code: discard any leading garbage
                        if pos > 0:
                            buf = bytearray(buf[pos:])
                        prev_sc_pos = 0
                        prev_sc_len = sc_len
                        search_start = sc_len

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
