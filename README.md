# Maison Money — C++ Full-stack Version

The frontend remains HTML/CSS/JavaScript with the same Navy Blue, Emerald Green and White theme, clickable 3D coin animation, budget planner, transaction ledger, savings goals and learning links. The backend is now **C++17**, using cpp-httplib, nlohmann/json and SQLite.

## Project layout
```
maison_money_cpp/
├── CMakeLists.txt
├── src_main.cpp
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── app.js
```

## Requirements (Windows)
- Visual Studio 2022 with the "Desktop development with C++" workload, or MinGW-w64
- CMake 3.20+
- Git (CMake downloads cpp-httplib and nlohmann/json on the first configure)
- SQLite3 development library/header (`sqlite3.h` and SQLite library)

## Build using CMake (recommended)
Open PowerShell in the project folder:

```powershell
cmake -S . -B build
cmake --build build --config Release
```

If CMake cannot find SQLite3, install SQLite development files and set `CMAKE_PREFIX_PATH` to their installation directory, or install SQLite using vcpkg:

```powershell
vcpkg install sqlite3:x64-windows
cmake -S . -B build -DCMAKE_TOOLCHAIN_FILE="C:/path/to/vcpkg/scripts/buildsystems/vcpkg.cmake"
cmake --build build --config Release
```

## Run
Run from the project root so `templates/` and `static/` are found.

For Visual Studio generator:
```powershell
.\build\Release\maison_money.exe
```
For MinGW / single-config generator:
```powershell
.\build\maison_money.exe
```

Then open `http://127.0.0.1:5000`.

The database is created automatically at `instance/maison_money.db`. You can change the port with the `PORT` environment variable and the database path with `MAISON_DB_PATH`.

## API routes
- `GET /api/dashboard?month=YYYY-MM`
- `POST /api/budget`
- `POST /api/transactions`
- `DELETE /api/transactions/{id}`
- `POST /api/goals`
- `PATCH /api/goals/{id}`
- `DELETE /api/goals/{id}`

All write endpoints accept JSON and return JSON.

## Notes
- Internet is needed once during CMake configure to fetch cpp-httplib and nlohmann/json.
- SQLite3 development files are a separate dependency. On Windows, vcpkg is a convenient way to install it.
- This is a local learning/demo application and has no authentication or per-user data isolation. Do not expose it publicly or enter sensitive financial information until authentication, CSRF protection, access control, secure deployment settings and backups are implemented.
- Investment content is educational only, not financial advice.
