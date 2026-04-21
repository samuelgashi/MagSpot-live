import subprocess
import threading
import time
import re
import os
from app.config import Config

class ProcessManager:
    def __init__(self):
        self.processes = {}
        self.cloudflared_url = None
        self.url_detected = False
        
    def start_process(self, name, command, cwd=None, capture_output=False):
        """Start a subprocess and track it"""
        if name in self.processes:
            return False
            
        env = os.environ.copy()
        env["ADB_SERVER_SOCKET"] = f"tcp:127.0.0.1:{Config.ADB_PORT}"
        env["PATH"] = f"{os.path.dirname(Config.ADB_PATH)}:" + env["PATH"]
        
        if capture_output:
            process = subprocess.Popen(
                command,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
                universal_newlines=True,
                env=env
            )
            
            # Start threads to read stdout and stderr
            threading.Thread(target=self._read_output, args=(process.stdout, name, 'stdout'), daemon=True).start()
            threading.Thread(target=self._read_output, args=(process.stderr, name, 'stderr'), daemon=True).start()
        else:
            process = subprocess.Popen(command, cwd=cwd, env=env)
        
        self.processes[name] = {
            'process': process,
            'start_time': time.time(),
            'output_lines': []
        }
        
        if name == 'cloudflared':
            self.url_detected = False
            self.cloudflared_url = None
        
        return True
    
    def _read_output(self, pipe, process_name, stream_type):
        """Read output from a subprocess pipe and log it."""
        try:
            for line in iter(pipe.readline, ''):
                if line:
                    line = line.rstrip()
                    if process_name in self.processes:
                        self.processes[process_name]['output_lines'].append(line)
                    
                    print(f"[{process_name}:{stream_type}] {line}")
                    
                    if process_name == 'cloudflared' and not self.url_detected:
                        url_match = re.search(r'https://[^\s]+\.trycloudflare\.com', line)
                        if url_match:
                            self.cloudflared_url = url_match.group(0)
                            self.url_detected = True
            pipe.close()
        except Exception as e:
            print(f"Error reading {stream_type} for {process_name}: {e}")
    
    def stop_process(self, name):
        """Stop a tracked subprocess gracefully."""
        if name not in self.processes:
            return False
            
        process_info = self.processes[name]
        process = process_info['process']
        
        try:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
                
            del self.processes[name]
            
            if name == 'cloudflared':
                self.cloudflared_url = None
                self.url_detected = False
                
            return True
        except Exception as e:
            print(f"Error stopping process {name}: {e}")
            return False
    
    def is_process_running(self, name):
        """Check if a process is still running."""
        if name not in self.processes:
            return False
        return self.processes[name]['process'].poll() is None
    
    def get_process_info(self, name):
        """Get information about a process."""
        if name not in self.processes:
            return None
        
        process_info = self.processes[name]
        process = process_info['process']
        
        return {
            'pid': process.pid,
            'running': self.is_process_running(name),
            'start_time': process_info['start_time'],
            'uptime': time.time() - process_info['start_time']
        }
    
    def get_cloudflared_url(self, timeout=20):
        """Get the public URL from cloudflared, waiting for it to be detected."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            if self.url_detected and self.cloudflared_url:
                return self.cloudflared_url
            time.sleep(1)
        return None
    
    def get_all_processes(self):
        """Get information about all running processes."""
        return {name: self.get_process_info(name) for name in self.processes}