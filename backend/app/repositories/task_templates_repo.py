from app.db.session import SessionLocal
from app.models.task_templates import TaskTemplate

def db_get_task_templates(user_id):
    with SessionLocal() as session:
        rows = session.query(TaskTemplate).filter_by(user_id=user_id).order_by(TaskTemplate.id).all()
        return [_serialize(t) for t in rows]

def db_get_task_template(user_id, template_id):
    with SessionLocal() as session:
        row = session.query(TaskTemplate).filter_by(user_id=user_id, id=template_id).first()
        return _serialize(row) if row else None

def db_create_task_template(user_id, name, description=None, type="custom",
                             script_ref=None, duration_min=30, duration_max=120):
    with SessionLocal() as session:
        t = TaskTemplate(
            user_id=user_id,
            name=name,
            description=description,
            type=type,
            script_ref=script_ref,
            duration_min=duration_min,
            duration_max=duration_max,
        )
        session.add(t)
        session.commit()
        session.refresh(t)
        return _serialize(t)

def db_update_task_template(user_id, template_id, **kwargs):
    with SessionLocal() as session:
        allowed = {"name", "description", "type", "script_ref", "duration_min", "duration_max"}
        update_dict = {k: v for k, v in kwargs.items() if k in allowed and v is not None}
        result = session.query(TaskTemplate).filter_by(user_id=user_id, id=template_id).update(update_dict)
        session.commit()
        if result == 0:
            return None
        row = session.query(TaskTemplate).filter_by(user_id=user_id, id=template_id).first()
        return _serialize(row) if row else None

def db_delete_task_template(user_id, template_id):
    with SessionLocal() as session:
        result = session.query(TaskTemplate).filter_by(user_id=user_id, id=template_id).delete()
        session.commit()
        return result > 0

def _serialize(t):
    if not t:
        return None
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "type": t.type,
        "scriptRef": t.script_ref,
        "durationMin": t.duration_min,
        "durationMax": t.duration_max,
        "createdAt": t.created_at.isoformat() if t.created_at else None,
    }
