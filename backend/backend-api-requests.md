
### 1.1 Authenticate Admin
- **POST** `/authenticate_admin` Generates an admin JWT.

  ```bash
  curl -X POST {{baseUrl}}/authenticate_admin \
    -H "Content-Type: application/json" \
    -d '{"admin_key": "{{admin_secret_key}}"}'
  ```

### 1.2 Create API Key
- **POST** `/api_keys`  Creates a new API key.
  ```bash
  curl -X POST {{baseUrl}}/api_keys \
  -H "Content-Type: application/json" \
  -H "x-access-token: {{admin_token}}" \
  -d '{"life_time": {{life_time}}, "authorized_endpoints": "*"}'
  ```
- **GET** `/api_keys` Retrieves a list of all API keys.
  ```bash
  curl -X GET {{baseUrl}}/api_keys \
    -H "x-access-token: {{admin_token}}"
  ```

- **GET** `/api_keys/<key_id>` Get Specific API Key Using Key ID
  ```bash
  curl -X GET {{baseUrl}}/api_keys/{{key_id}} \
    -H "x-access-token: {{admin_token}}"
  ```
- **DELETE** `/api_keys/<key_id>` Deletes a specific API key by its unique ID.
  ```bash
  curl -X DELETE {{baseUrl}}/api_keys/{{key_id}} \
    -H "x-access-token: {{admin_token}}"
  ```

### 1.3 Users Managements:
*All endpoints in this section require an Admin JWT in the `x-access-token` header.*
- **Get All Users** `/admin/users` Retrieves a list of all users in the database.

  ```bash
  curl -X GET {{baseUrl}}/admin/users \
  -H "x-access-token: {{admin_token}}"
  ```
- **Delete User** `/admin/users` Retrieves a list of all users in the database.

  ```bash
  curl -X DELETE {{baseUrl}}/admin/users \
  -H "x-access-token: {{admin_token}}" \
  -d '{"user_id":"{{user_id}}"}' \
  -H "Content-Type: application/json"
  ```

### 1.4 Stream:
- **Stream By Artist** `/api/yt_music/stream_by_artist`
    ```bash
    curl -X POST http://localhost:5000/api/yt_music/stream_by_artist \
    -H "Content-Type: application/json" \
    -H "user_id: admin" \
    -H "x-access-token: {{admin_token}}" \
    -H "x-api-key: {{api_key}}" \
    -d '{
        "artist_name": "Coldplay",
        "play_hours": 4,
        "device_id": "device123",
        "x-access-token": "{{admin_token}}"
        "isOverrideResolution": {{isOverrideResolution}}
    }'
    ```

- **Steam By Library** `/api/yt_music/stream_by_library`
  ```bash
  curl -X POST http://localhost:5000/api/yt_music/stream_by_library \
  -H "Content-Type: application/json" \
  -H "user_id: admin" \
  -H "x-access-token: {{admin_token}}" \
  -H "x-api-key: {{api_key}}" \
  -d '{
    "device_id": "device123",
    "playlist_name": "My Favorite Artist",
    "playlists_sheet_url": null,
    "play_hours": 10,
    "isOverrideResolution": {{isOverrideResolution}}
    
  }'
  ```
- **Steam By Library** `/api/yt_music/stream_by_playlist`
  ```bash
  curl -X POST http://localhost:5000/api/yt_music/stream_by_playlist \
  -H "Content-Type: application/json" \
  -H "user_id: admin" \
  -H "x-access-token: {{admin_token}}" \
  -H "x-api-key: {{api_key}}" \
  -d '{
    "device_id": "device123",
    "playlist_name": "My Favorite Artist",
    "playlists_sheet_url": null,
    "play_hours": 10,
    "isOverrideResolution": {{isOverrideResolution}}
  }'
  ```
- **Assign Multiple Tasks** `/api/yt_music/stream_by_playlist`
  ```bash
  curl -X POST http://localhost:5000/api/yt_music/assign_tasks \
  -H "Content-Type: application/json" \
  -H "x-access-token: {{admin_token}}" \
  -H "x-api-key: {{api_key}}" \
  -d '{
    "device_id": "{{device_id}}",
    "isOverrideResolution": {{isOverrideResolution}},
    "tasks": [
      {
        "type": "stream_by_playlist",
        "playlist_name": "My Playlist",
        "playlists_sheet_url": null,
        "play_hours": 5
      },
      {
        "type": "stream_library",
        "playlist_name": "Library Playlist",
        "playlists_sheet_url": null,
        "play_hours": 8
      },
      {
        "type": "stream_by_artist",
        "artist_name": "Coldplay",
        "artists_sheet_url": null,
        "play_hours": 12
      }
    ]
  }'
  ```


- **Free Android Device**
  ```bash
  curl -X POST "http://localhost:5000/devices/{{device_id}}/free?user_id={{user_id}}" \
  -H "x-access-token: {{admin_token}}" \
  -H "Content-Type: application/json"
  ```

### 1.5 Tasks Managements:

- **Get All Tasks**  `GET /api/tasks`  
    ```bash
    curl -X GET http://localhost:5000/api/tasks \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```

- **Clear All Tasks** `DELETE /api/tasks`  
    ```bash
    curl -X DELETE http://localhost:5000/api/tasks \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```

- **Get Task by ID**  `GET /api/tasks/<task_id>`  
    ```bash
    curl -X GET http://localhost:5000/api/tasks/TASK_ID_HERE \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```

- **Stop Task by ID** `POST /api/tasks/<task_id>/stop`  
    ```bash
    curl -X POST http://localhost:5000/api/tasks/TASK_ID_HERE/stop \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```

- **Stop All Tasks** `POST /api/tasks/stop-all`  
    ```bash
    curl -X POST http://localhost:5000/api/tasks/stop-all \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
    ```