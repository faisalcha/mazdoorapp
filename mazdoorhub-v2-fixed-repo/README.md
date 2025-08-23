# MazdoorHub v2 (Fixed)

This is the fixed, ready-to-run bundle with all 1–20 features and the applied fixes (Flutter syntax/pubspec, DI push, ratings role-check, completed_at, devices heartbeat, DB indexes).

## Backend
```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api npm run build
docker compose exec api npm run typeorm:run
docker compose exec api node dist/scripts/seed.js
# nightly (optional)
docker compose exec api npm run nightly
```

## Mobile
```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE=http://10.0.2.2:8080
```
