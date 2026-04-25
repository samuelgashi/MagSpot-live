# Assume engine and Session are configured
from sqlalchemy import Column, String, Text, TIMESTAMP, ForeignKey 
# from sqlalchemy.orm import relationship, declarative_base, Session 
from app.db.session import SessionLocal, engine
from sqlalchemy import create_engine, update 
from datetime import datetime

from app.db.session import Base, engine
from app.models.devices import *

def get_device_details(user_id, device_id):
    with SessionLocal() as session:
        device = session.query(AndroidDevice).filter_by(user_id=user_id, device_id=device_id).first()
        if not device: return None
        return {
            'valid': True,
            'device': {
                "device_id": device.device_id,
                "android_ip": device.android_ip,
                "android_name": device.android_name,
                "serial_number": device.serial_number,
                "status": device.status,
                "current_task_id": device.current_task_id,
                "last_seen": device.last_seen
            }
        }


def db_add_android_device(user_id, device_id, android_ip, android_name, serial_number=None):
    with SessionLocal() as session:
        new_device = AndroidDevice(
            user_id=user_id,
            device_id=device_id,
            android_ip=android_ip,
            android_name=android_name,
            serial_number=serial_number
        )
        session.add(new_device)
        session.commit()
        return True


def db_get_android_devices(user_id):
    with SessionLocal() as session:
        devices = session.query(AndroidDevice).filter_by(user_id=user_id).all()
        return [
            {
                "device_id": d.device_id, 
                "android_ip": d.android_ip, 
                "android_name": d.android_name,
                "serial_number": d.serial_number,
                "status": d.status
            }
            for d in devices
        ]


def db_get_android_device(user_id, device_id):
    with SessionLocal() as session:
        device = session.query(AndroidDevice).filter_by(user_id=user_id, device_id=device_id).first()
        if not device:
            return None
        return {
            "device_id": device.device_id,
            "android_ip": device.android_ip,
            "android_name": device.android_name,
            "serial_number": device.serial_number,
            "status": device.status,
            "current_task_id": device.current_task_id,
            "last_seen": device.last_seen
        }


def db_get_android_device_by_sn(user_id, serial_number):
    """Get device by serial number"""
    with SessionLocal() as session:
        device = session.query(AndroidDevice).filter_by(user_id=user_id, serial_number=serial_number).first()
        if not device:
            return None
        return {
            "device_id": device.device_id,
            "android_ip": device.android_ip,
            "android_name": device.android_name,
            "serial_number": device.serial_number,
            "status": device.status,
            "current_task_id": device.current_task_id,
            "last_seen": device.last_seen
        }


def db_get_online_devices(user_id):
    """Get all devices with FREE status"""
    with SessionLocal() as session:
        devices = session.query(AndroidDevice).filter_by(user_id=user_id, status="FREE").all()
        return [
            {
                "device_id": d.device_id,
                "android_ip": d.android_ip,
                "android_name": d.android_name,
                "serial_number": d.serial_number,
                "status": d.status
            }
            for d in devices
        ]


def db_update_android_device(user_id, device_id, update_dict):
    with SessionLocal() as session:
        result = session.query(AndroidDevice).filter_by(
            user_id=user_id, device_id=device_id
        ).update(update_dict)
        session.commit()
        return result > 0


def db_delete_android_device(user_id, device_id):
    with SessionLocal() as session:
        deleted = session.query(AndroidDevice).filter_by(user_id=user_id, device_id=device_id).delete()
        session.commit()
        return deleted > 0


def book_device(user_id, device_id, task_id):
    with SessionLocal() as session:
        device = session.query(AndroidDevice).filter_by(user_id=user_id, device_id=device_id, status="FREE").first()
        if not device:
            return False
        device.status = "BUSY"
        device.current_task_id = task_id
        session.commit()
        return True


def release_device(user_id, device_id):
    with SessionLocal() as session:
        device = session.query(AndroidDevice).filter_by(user_id=user_id, device_id=device_id).first()
        if not device: return False
        device.status = "FREE"
        device.current_task_id = None
        session.commit()
        return True
