import os
import hashlib
from cryptography.fernet import Fernet

def get_fernet():
    key = os.environ.get('FERNET_KEY')
    if not key:
        raise ValueError("FERNET_KEY 환경변수가 없습니다.")
    return Fernet(key.encode())

def encrypt(value: str) -> str:
    """평문 → 암호화"""
    if not value:
        return value
    f = get_fernet()
    return f.encrypt(value.encode()).decode()

def decrypt(encrypted_value: str) -> str:
    """암호화 → 평문"""
    if not encrypted_value:
        return encrypted_value
    f = get_fernet()
    return f.decrypt(encrypted_value.encode()).decode()

def hash_value(value: str) -> str:
    """SHA-256 해시 (검색용)"""
    if not value:
        return value
    return hashlib.sha256(value.encode()).hexdigest()