# CLI `mcp-apps-studio`

## Purpose

CLI обнаруживает story-файлы в проекте пользователя, собирает из них манифест и отдаёт собранную студию по локальному HTTP с одноразовым токеном. Подкоманда `add` копирует компонент из реестра в проект. Локальный dev-инструмент остаётся поверхностью атаки, поэтому сервер защищён по умолчанию.

## Requirements

### Requirement: Обнаружение story-файлов
`findStoryFiles(root)` SHALL рекурсивно находить файлы `*.stories.mcp.ts`, пропуская каталоги `node_modules`, `dist`, `build` и скрытые (начинающиеся с точки), и возвращать отсортированный список.

#### Scenario: Ловушка в node_modules
- **WHEN** `node_modules/dep/evil.stories.mcp.ts` существует рядом с `src/kpi.stories.mcp.ts`
- **THEN** найден только `src/kpi.stories.mcp.ts`

### Requirement: Загрузка и валидация story
`discoverStories` SHALL транспилировать story esbuild-ом, записать временный `.mjs` рядом с файлом (чтобы импорты story резолвились из проекта пользователя), импортировать его и удалить временный файл даже при ошибке. Default-экспорт SHALL проверяться схемой `widgetStoryConfigSchema`; ошибка SHALL называть файл и путь до поля.

#### Scenario: Опечатка в моке
- **WHEN** story содержит `mocks: { get_data: { kind: 'statik' } }`
- **THEN** discovery отклоняется ошибкой, содержащей имя файла и `scenarios.default.mocks.get_data.kind`

#### Scenario: Нет default-экспорта
- **WHEN** story экспортирует только `const x = 1`
- **THEN** ошибка называет файл и говорит об отсутствии default-экспорта

#### Scenario: Чистка временных файлов
- **WHEN** discovery завершилось
- **THEN** рядом со story нет файлов `.mjs`

### Requirement: Манифест из story
Каждая story SHALL превращаться в `WidgetManifestEntry`: `id` — имя файла без суффикса, `title`, `html` — содержимое файла по пути `widget` относительно story, `scenarios` — с `mocks`, нормализованными к `{}` при отсутствии.

#### Scenario: Сценарий без моков
- **WHEN** story содержит `scenarios: { empty: {} }`
- **THEN** манифест содержит `scenarios.empty === { mocks: {} }`

### Requirement: Только localhost и токен на каждый запрос
Сервер SHALL слушать только `127.0.0.1`. Каждый запрос SHALL нести токен: в `?token=` (тогда сервер ставит cookie `HttpOnly; SameSite=Strict`) либо в cookie. Сравнение SHALL быть в постоянное время (хэш обеих сторон + `timingSafeEqual`). Без верного токена ответ SHALL быть `401`.

#### Scenario: Без токена
- **WHEN** запрос `/` без токена и cookie
- **THEN** статус `401`

#### Scenario: Неверный токен
- **WHEN** запрос с `?token=` другой строкой той же длины
- **THEN** статус `401`

#### Scenario: Первый заход по ссылке из консоли
- **WHEN** запрос `/?token=<верный>`
- **THEN** статус `200`, заголовок `Set-Cookie` содержит `HttpOnly`
- **AND** последующие запросы с cookie проходят без `?token=`

### Requirement: Манифест по запросу
`GET /api/manifest` SHALL заново выполнять discovery при каждом запросе (правки story видны по обновлению страницы), отвечать JSON `{ widgets }` с `cache-control: no-store`; сбой discovery SHALL давать `500` с текстом ошибки, не завершая процесс.

#### Scenario: Story правится
- **WHEN** два запроса подряд, а между ними story изменена
- **THEN** второй ответ отражает изменение

#### Scenario: Story сломана на середине правки
- **WHEN** discovery бросает ошибку
- **THEN** статус `500` с текстом ошибки
- **AND** следующий запрос `/` отвечает `200`

### Requirement: Статика студии
Сервер SHALL отдавать файлы из `dist` студии с MIME по расширению; путь вне `dist` SHALL давать `403`; некорректное percent-кодирование — `400`; отсутствующий файл с известным расширением — `404`; прочие пути — `index.html` (SPA-fallback).

#### Scenario: Обход каталога
- **WHEN** запрос `/..%2f..%2fetc%2fpasswd`
- **THEN** содержимое файла вне `dist` не отдаётся

#### Scenario: Опечатка в имени ассета
- **WHEN** запрос `/assets/typo.js`
- **THEN** статус `404`, а не `index.html`

### Requirement: Точка входа bin
`bin` SHALL принимать корневой каталог проекта, `--port` (по умолчанию 4400), `--token` (только для автоматизации; по умолчанию случайный), требовать собранную студию и печатать URL с токеном. При отсутствии story SHALL сообщить, что будет показан демо-виджет.

#### Scenario: Студия не собрана
- **WHEN** `dist/index.html` студии отсутствует
- **THEN** процесс завершается с подсказкой `pnpm -F @studio/app build`

### Requirement: Подкоманда add
`add <name> [--dir <dir>]` SHALL скопировать файлы компонента из `registry.json` в `<dir>/<name>/` (по умолчанию `src/components`) и напомнить о зависимости `@studio/widget-runtime`. Неизвестное имя SHALL давать ошибку с перечнем доступных компонентов.

#### Scenario: Неизвестный компонент
- **WHEN** выполняется `add nope`
- **THEN** ошибка перечисляет `kpi-card` и `data-table`
