import uuid
from sqlalchemy import and_
from app.db.session import SessionLocal
from app.models.groups import DeviceGroup, GroupDevice

def _is_valid_serial_number(sn):
    """Check if serial number is valid (not None, not 'Unknown', not empty string)"""
    return sn and sn.strip() and sn.strip().lower() != "unknown"

def db_create_group(user_id, name):
    with SessionLocal() as session:
        group_id = str(uuid.uuid4())
        new_group = DeviceGroup(
            group_id=group_id,
            user_id=user_id,
            name=name
        )
        session.add(new_group)
        session.commit()
        return group_id

def db_get_groups(user_id):
    with SessionLocal() as session:
        groups = session.query(DeviceGroup).filter_by(user_id=user_id).all()
        return [
            {
                "group_id": g.group_id,
                "name": g.name,
                "created_at": g.created_at,
                "updated_at": g.updated_at,
                "devices": [
                    {
                        "id": d.id,
                        "serial_number": d.serial_number,
                        "device_name": d.device_name,
                        "model_name": d.model_name
                    }
                    for d in g.devices
                ]
            }
            for g in groups
        ]

def db_get_group(user_id, group_id):
    with SessionLocal() as session:
        group = session.query(DeviceGroup).filter_by(user_id=user_id, group_id=group_id).first()
        if not group:
            return None
        return {
            "group_id": group.group_id,
            "name": group.name,
            "created_at": group.created_at,
            "updated_at": group.updated_at,
            "devices": [
                {
                    "id": d.id,
                    "serial_number": d.serial_number,
                    "device_name": d.device_name,
                    "model_name": d.model_name
                }
                for d in group.devices
            ]
        }

def db_update_group(user_id, group_id, name):
    with SessionLocal() as session:
        result = session.query(DeviceGroup).filter_by(user_id=user_id, group_id=group_id).update({"name": name})
        session.commit()
        return result > 0

def db_delete_group(user_id, group_id):
    with SessionLocal() as session:
        result = session.query(DeviceGroup).filter_by(user_id=user_id, group_id=group_id).delete()
        session.commit()
        return result > 0

def db_add_device_to_group(user_id, group_id, serial_number, device_name=None, model_name=None):
    """Add a single device to group using S/N"""
    with SessionLocal() as session:
        # Validate serial number
        if not _is_valid_serial_number(serial_number):
            return None
        
        # Check if group exists and belongs to user
        group = session.query(DeviceGroup).filter_by(user_id=user_id, group_id=group_id).first()
        if not group:
            return None
        
        # Check for duplicate within the same group (same serial_number)
        existing = session.query(GroupDevice).filter_by(
            group_id=group_id, 
            serial_number=serial_number.strip()
        ).first()
        if existing:
            return None
        
        device_id = str(uuid.uuid4())
        new_device = GroupDevice(
            id=device_id,
            group_id=group_id,
            serial_number=serial_number.strip(),
            device_name=device_name,
            model_name=model_name
        )
        session.add(new_device)
        session.commit()
        return device_id

def db_add_devices_to_group(user_id, group_id, devices):
    """Add multiple devices to a group at once. Only devices with valid S/N are added."""
    with SessionLocal() as session:
        group = session.query(DeviceGroup).filter_by(user_id=user_id, group_id=group_id).first()
        if not group:
            return []
        
        added_ids = []
        for device in devices:
            serial_number = device.get('serial_number')
            
            # Skip invalid S/N (None, empty, or "Unknown")
            if not _is_valid_serial_number(serial_number):
                continue
            
            serial_number = serial_number.strip()
            
            # Check for duplicate within the same group
            existing = session.query(GroupDevice).filter_by(
                group_id=group_id,
                serial_number=serial_number
            ).first()
            
            if existing:
                continue
            
            device_id = str(uuid.uuid4())
            new_device = GroupDevice(
                id=device_id,
                group_id=group_id,
                serial_number=serial_number,
                device_name=device.get('device_name'),
                model_name=device.get('model_name')
            )
            session.add(new_device)
            added_ids.append(device_id)
        
        session.commit()
        return added_ids

def db_remove_device_from_group(user_id, group_id, device_id):
    """Remove a device from group by device id"""
    with SessionLocal() as session:
        # Verify group belongs to user
        group = session.query(DeviceGroup).filter_by(user_id=user_id, group_id=group_id).first()
        if not group:
            return False
        
        result = session.query(GroupDevice).filter_by(id=device_id, group_id=group_id).delete()
        session.commit()
        return result > 0

def db_clear_group_devices(user_id, group_id):
    """Remove all devices from a group"""
    with SessionLocal() as session:
        group = session.query(DeviceGroup).filter_by(user_id=user_id, group_id=group_id).first()
        if not group:
            return False
        
        session.query(GroupDevice).filter_by(group_id=group_id).delete()
        session.commit()
        return True

def db_group_exists(user_id, group_id):
    with SessionLocal() as session:
        group = session.query(DeviceGroup).filter_by(user_id=user_id, group_id=group_id).first()
        return group is not None

def db_get_group_devices_sn(user_id, group_id):
    """Get list of serial numbers for devices in a group"""
    with SessionLocal() as session:
        group = session.query(DeviceGroup).filter_by(user_id=user_id, group_id=group_id).first()
        if not group:
            return None
        return [d.serial_number for d in group.devices]
