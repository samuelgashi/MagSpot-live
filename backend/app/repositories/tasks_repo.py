from datetime import datetime
from app.models.tasks import Task
from app.db.session import SessionLocal
from app.repositories.tasks_repo import *
from app.models.devices import AndroidDevice
from app.utils.auth import api_key_required, auth_required
from app.utils.runtime import TASK_CANCEL_EVENTS, TASK_THREADS, TASK_RUNTIME


def update_task(user_id, task_id, status=None, progress=None, log=None):
    # UPDATE LOG
    if log:
        timestamp = datetime.now().strftime("[%Y-%m-%d %H:%M:%S] ")
        db_update_logs(user_id, timestamp, log, task_id)

    # UPDATE STATUS / PROGRESS
    with SessionLocal() as session:
        task = session.query(Task).filter_by(user_id=user_id, task_id=task_id).first()
        if not task: return False
        if status: task.status = status
        if progress is not None: task.progress = progress
        task.updated_at = datetime.utcnow()
        session.commit()
        return True



def db_get_task(user_id, device_id):
    """Get current task_id from Android_Devices"""
    with SessionLocal() as session:
        device = session.query(AndroidDevice).filter_by(user_id=user_id, device_id=device_id).first()
        if not device:
            return None
        return {"current_task_id": device.current_task_id}


def create_task(user_id, task_id, device_id):
    """Create a task with fixed type 'YOUTUBE_SHORT'"""
    with SessionLocal() as session:
        new_task = Task(
            user_id=user_id,
            task_id=task_id,
            device_id=device_id,
            task_type="YOUTUBE_SHORT",
            status="QUEUED"
        )
        session.add(new_task)
        session.commit()
        return True


def db_create_task(user_id, task_id, device_id, task_type):
    """Create a task with dynamic type"""
    with SessionLocal() as session:
        new_task = Task(
            user_id=user_id,
            task_id=task_id,
            device_id=device_id,
            task_type=task_type,
            status="QUEUED"
        )
        session.add(new_task)
        session.commit()
        return True


def db_update_logs(user_id, timestamp, log, task_id):
    """Append logs to existing task logs"""
    with SessionLocal() as session:
        task = session.query(Task).filter_by(user_id=user_id, task_id=task_id).first()
        if not task:
            return False
        task.logs = (task.logs or "") + f"{timestamp}{log}\n"
        session.commit()
        return True


def db_get_tasks(user_id):
    """Get all tasks for a user ordered by created_at DESC"""
    with SessionLocal() as session:
        tasks = session.query(Task).filter_by(user_id=user_id).order_by(Task.created_at.desc()).all()
        return [
            {
                "task_id": t.task_id,
                "device_id": t.device_id,
                "status": t.status,
                "progress": t.progress,
                "logs": t.logs,
                "task_type": t.task_type,
                "created_at": t.created_at
            }
            for t in tasks
        ]


def db_get_task_by_id(user_id, task_id):
    """Get a single task by ID"""
    with SessionLocal() as session:
        task = session.query(Task).filter_by(user_id=user_id, task_id=task_id).first()
        if not task: return None
        return {
            "task_id": task.task_id,
            "device_id": task.device_id,
            "status": task.status,
            "progress": task.progress,
            "logs": task.logs,
            "task_type": task.task_type,
            "updated_at": task.updated_at
        }


def db_update_task(user_id, fields, values):
    """Update task fields dynamically"""
    with SessionLocal() as session:
        task_id = values[0]  # first value is task_id
        update_dict = dict(zip([f.split("=")[0].strip() for f in fields], values[1:-1]))
        session.query(Task).filter_by(user_id=user_id, task_id=task_id).update(update_dict)
        session.commit()
        return True


def db_delete_all_tasks(user_id):
    """Delete all tasks for a user"""
    with SessionLocal() as session:
        session.query(Task).filter_by(user_id=user_id).delete()
        session.commit()
        return True
