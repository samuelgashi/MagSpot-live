import hmac
import base64
import hashlib
from app.config import Config
from cryptography.fernet import Fernet

SECRET_KEY = Config.SECRET_KEY

key = base64.urlsafe_b64encode(SECRET_KEY.encode("utf-8").ljust(32)[:32])
cipher_suite = Fernet(key)

def hash_api_key(api_key: str) -> str:
    return hmac.new(SECRET_KEY.encode(), api_key.encode(), hashlib.sha256).hexdigest()

def encrypt_data(data):
    if data is None:
        return None
    return cipher_suite.encrypt(data.encode("utf-8")).decode("utf-8")

def decrypt_data(encrypted_data):
    if encrypted_data is None:
        return None
    return cipher_suite.decrypt(encrypted_data.encode("utf-8")).decode("utf-8")