import threading

TASK_CANCEL_EVENTS = {}   # task_id -> threading.Event
TASK_THREADS = {}         # task_id -> Thread
TASK_RUNTIME = {}         # task_id -> { device_id, container_id }