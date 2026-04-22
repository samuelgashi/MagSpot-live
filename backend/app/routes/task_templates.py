from . import api_bp
from flask import request, jsonify, g
from app.utils.auth import auth_required
from app.repositories.task_templates_repo import (
    db_get_task_templates,
    db_get_task_template,
    db_create_task_template,
    db_update_task_template,
    db_delete_task_template,
)


@api_bp.route('/task_templates', methods=['GET'])
@auth_required
def list_task_templates():
    rows = db_get_task_templates(g.user_id)
    return jsonify(rows), 200


@api_bp.route('/task_templates', methods=['POST'])
@auth_required
def create_task_template():
    data = request.get_json() or {}
    if not data.get('name'):
        return jsonify({'error': 'name is required'}), 400
    row = db_create_task_template(
        user_id=g.user_id,
        name=data['name'],
        description=data.get('description'),
        type=data.get('type', 'custom'),
        script_ref=data.get('scriptRef') or data.get('script_ref'),
        duration_min=data.get('durationMin') or data.get('duration_min') or 30,
        duration_max=data.get('durationMax') or data.get('duration_max') or 120,
    )
    return jsonify(row), 201


@api_bp.route('/task_templates/<int:template_id>', methods=['GET'])
@auth_required
def get_task_template(template_id):
    row = db_get_task_template(g.user_id, template_id)
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row), 200


@api_bp.route('/task_templates/<int:template_id>', methods=['PUT'])
@auth_required
def update_task_template(template_id):
    data = request.get_json() or {}
    row = db_update_task_template(
        g.user_id,
        template_id,
        name=data.get('name'),
        description=data.get('description'),
        type=data.get('type'),
        script_ref=data.get('scriptRef') or data.get('script_ref'),
        duration_min=data.get('durationMin') or data.get('duration_min'),
        duration_max=data.get('durationMax') or data.get('duration_max'),
    )
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify(row), 200


@api_bp.route('/task_templates/<int:template_id>', methods=['DELETE'])
@auth_required
def delete_task_template(template_id):
    deleted = db_delete_task_template(g.user_id, template_id)
    if not deleted:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'message': 'Deleted'}), 200
