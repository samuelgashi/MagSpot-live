// API Service for Tasks
// This connects to the main Python backend for task management

// Get configured backend API URL
const getBackendUrl = () => localStorage.getItem('apiBackendUrl') || '/api';
const API_BASE = `${getBackendUrl()}`;

// Get API key
const getApiKey = () => localStorage.getItem('apiKey') || '';

// Helper to get headers with API key and auth token
const getHeaders = (authToken?: string) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = getApiKey();
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

export interface Task {
  task_id: string;
  device_id: string;
  status: string;
  progress?: number;
  logs?: string;
  task_type?: string;
  created_at?: string;
}

export interface ApiError {
  status: number;
  statusText: string;
  error: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
  statusText: string;
}

const taskApi = {
  async getAll(authToken?: string): Promise<ApiResponse<{ tasks: Task[] }>> {
    try {
      const response = await fetch(`${getBackendUrl()}/tasks`, {
        method: 'GET',
        headers: getHeaders(authToken),
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          error: data.error || 'Failed to fetch tasks',
          status: response.status,
          statusText: response.statusText,
        };
      }
      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        error: 'Network error',
        status: 0,
        statusText: 'Network Error',
      };
    }
  },

  async getStatus(taskId: string, authToken?: string): Promise<ApiResponse<Task>> {
    try {
      const response = await fetch(`${getBackendUrl()}/tasks/${taskId}`, {
        method: 'GET',
        headers: getHeaders(authToken),
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          error: data.error || 'Failed to fetch task status',
          status: response.status,
          statusText: response.statusText,
        };
      }
      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        error: 'Network error',
        status: 0,
        statusText: 'Network Error',
      };
    }
  },

  async stop(taskId: string, authToken?: string): Promise<ApiResponse<{ message: string; task_id: string }>> {
    try {
      const response = await fetch(`${getBackendUrl()}/tasks/${taskId}/stop`, {
        method: 'POST',
        headers: getHeaders(authToken),
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          error: data.error || 'Failed to stop task',
          status: response.status,
          statusText: response.statusText,
        };
      }
      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        error: 'Network error',
        status: 0,
        statusText: 'Network Error',
      };
    }
  },

  async stopAll(authToken?: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${getBackendUrl()}/tasks/stop-all`, {
        method: 'POST',
        headers: getHeaders(authToken),
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          error: data.error || 'Failed to stop all tasks',
          status: response.status,
          statusText: response.statusText,
        };
      }
      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        error: 'Network error',
        status: 0,
        statusText: 'Network Error',
      };
    }
  },

  async clearAll(authToken?: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await fetch(`${getBackendUrl()}/tasks`, {
        method: 'DELETE',
        headers: getHeaders(authToken),
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          error: data.error || 'Failed to clear all tasks',
          status: response.status,
          statusText: response.statusText,
        };
      }
      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        error: 'Network error',
        status: 0,
        statusText: 'Network Error',
      };
    }
  },
};

export { taskApi };