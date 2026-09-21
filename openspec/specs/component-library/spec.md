# Библиотека компонентов

## Purpose

`@studio/components` — распространяемая исходниками библиотека виджетов (модель shadcn): компонент копируется в проект пользователя командой `mcp-apps-studio add`, а не подключается зависимостью. Каждый компонент соблюдает единый контракт: тематизация через CSS-переменные хоста, текстовый fallback, story-файл со сценариями, общение с хостом только через `@studio/widget-runtime`.

## Requirements

### Requirement: Контракт компонента
Каждый компонент SHALL: тематизироваться только через переменные `--widget-*` с запасными значениями и селектор `[data-theme='dark']`; экспортировать текстовую функцию-fallback; иметь `*.stories.mcp.ts` со сценариями `default`, `loading` или `empty`, и `error`; MUST NOT обращаться к `window.parent` напрямую.

#### Scenario: Тёмная тема
- **WHEN** хост присылает `theme: 'dark'` и рантайм ставит `data-theme="dark"`
- **THEN** компонент меняет фон и цвет текста без перезагрузки

#### Scenario: Хост без поддержки UI
- **WHEN** сервер отвечает только текстом
- **THEN** функция-fallback компонента даёт эквивалентное текстовое представление

### Requirement: Самодостаточная сборка
`build.mjs` SHALL собирать каждый компонент в один файл `dist/<name>.html` (vite + singlefile, target es2022, точки входа используют top-level await). Story-файлы указывают на `dist`, поэтому сборка SHALL предшествовать показу библиотеки в студии.

#### Scenario: Сборка библиотеки
- **WHEN** выполняется `pnpm -F @studio/components build`
- **THEN** появляются `dist/kpi-card.html` и `dist/data-table.html`
- **AND** каждый файл рендерится в sandboxed iframe без внешних запросов

### Requirement: Точка входа виджета
Точка входа компонента SHALL создать `WidgetClient`, дождаться `connect()`, применить контекст к документу, подписаться на его изменения, смонтировать компонент внутри `WidgetProvider` и сообщить хосту размер.

#### Scenario: Загрузка в студии
- **WHEN** iframe с собранным компонентом загружается
- **THEN** в трассе появляются `ui/initialize`, `tools/call` и `size-changed` от виджета

### Requirement: KPI Card
`KpiCard` SHALL при монтировании вызвать инструмент (по умолчанию `get_metrics`), показывать `value` через `toLocaleString`, подпись с `label` и направлением `delta`, состояние `loading…`, текст ошибки и кнопку `Refresh` с `type="button"`.

#### Scenario: Данные получены
- **WHEN** инструмент вернул `{ value: 12840, delta: 8.3, label: 'Monthly active users' }`
- **THEN** значение отображается как `12,840`, статус содержит `Monthly active users ▲8.3%`

#### Scenario: Ошибка инструмента
- **WHEN** инструмент отклонён с сообщением `Metrics backend unavailable`
- **THEN** статус содержит это сообщение и класс ошибки

### Requirement: Data Table
`DataTable` SHALL вызвать инструмент (по умолчанию `get_rows`), ожидать `{ columns: [{ key, label }], rows }`, показывать таблицу с заголовками из `columns`, состояние `loading…`, сообщение `No rows.` для пустого списка и текст ошибки. Fallback `dataTableTextFallback(data, maxRows)` SHALL выводить заголовок и первые `maxRows` строк с пометкой о скрытых.

#### Scenario: Пустой результат
- **WHEN** инструмент вернул `rows: []`
- **THEN** отображается `No rows.`

#### Scenario: Текстовый fallback с усечением
- **WHEN** три строки и `maxRows = 2`
- **THEN** текст содержит две строки и пометку `1 more row`

### Requirement: Реестр
`registry.json` SHALL перечислять компоненты с полями `name`, `title`, `description`, `files` (пути исходников) и `dependencies` (`@studio/widget-runtime`). Команда `add` SHALL копировать именно перечисленные файлы.

#### Scenario: Добавление kpi-card
- **WHEN** выполняется `mcp-apps-studio add kpi-card`
- **THEN** в целевой каталог копируются `KpiCard.tsx`, `kpi-card.css`, `fallback.ts`
