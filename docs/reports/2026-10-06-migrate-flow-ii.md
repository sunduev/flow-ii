# Перенос кода в flow-ii

6 октября 2026 года. Независимый snapshot из исходного HEAD `9c219093999fbd5e0575d64a819d3f3fc348c41f`; исходный chr-flow и его .git не изменялись. Экспортированы 164 tracked файла через git archive, до адаптации все побайтно совпадали. Ignored XLSX, .env, node_modules, сборки и прежняя Git-история не экспортированы. JSON обеих серий и два fixture побайтно сохранены; имена, ID и поведение неизменны.

Новый checkout — `/Users/sun/Dev/flow-ii`, origin — `https://github.com/sunduev/flow-ii.git`. До initial push API подтвердил private=true, fork=false, size=0, default_branch=main, admin/push=true, has_pages=false; Pages API 404, workflow total_count=0. Actions permissions API вернул 403: настройки разрешений не подтверждены. Публикация не включалась, manual workflow не запускался. Старый remote и его настройки не менялись.

Адаптация: vite.config.ts base `/flow-ii/`, соответствующие маршрутные/сборочные тесты, актуальные README/AGENTS/docs/plan/docs/README. Исторические отчёты и адреса их публикаций оставлены. `.github/workflows/pages.yml` сохранил jobs и permissions, оставлен только workflow_dispatch; автоматический push trigger можно восстановить только по отдельному поручению публикации. robots.txt не создавался.

## Локальная проверка

- Первый npm ci не прошёл из-за прав общего ~/.npm cache; следующие команды не могли найти tsc. Повтор с `npm ci --cache /private/tmp/flow-ii-npm-cache` успешен: 129 пакетов, 0 vulnerabilities. Общий cache не менялся.
- npm test: 77/77, без пропусков и ошибок.
- npm run typecheck: успешно.
- npm run build: успешно; Vite 7.3.6, 229 модулей.
- Проверены три dist HTML по реестру: один robots noindex,nofollow в head, ресурсы `/flow-ii/assets/`, относительный корневой редирект `./chr/` корректно ведёт под новый base. Dist JSON побайтно равны public/data.
- Браузерный preview на порту 4174: корень перешёл на /flow-ii/chr/, обе реальные серии при 1280×900 и 390×844. Карточки Борский корабел и Детективы для элит читаются; Enter открывает состав, Space фильтрует Руссо М./Потехин Д., Escape закрывает карточку; фильтр ЧР сохранился при скрытии 2026 диапазоном и снялся кнопкой. Ресурсный инвентарь каждой серии содержит только её history.json. Console warn/error пуст. Скриншоты просмотрены без сохранения. Viewport сброшен, вкладка закрыта, preview остановлен.

## Передача

На момент записи отчёта локальная подготовка проверена; initial commit и push выполняются следующим шагом. Финальное свидетельство SHA и remote-проверки передаётся в итоговом сообщении после фактического push, без выдуманных результатов публичного сайта. HTTP публичного сайта, кеш и поисковая индексация не проверялись: публикация не поручена.
