# Адаптер хоста

## Purpose

`HostAdapter` — чистый переводчик между wire-сообщениями конкретного диалекта (сейчас только MCP Apps) и семантическими действиями эмулятора. Без доступа к транспорту и без побочных эффектов: это делает адаптеры проверяемыми на «золотых» логах и позволяет подключить будущий `openai-apps` без правок эмулятора и студии.

## Requirements

### Requirement: Контракт адаптера
Адаптер SHALL реализовывать `id`, `buildIframeEnv`, `handleWidgetMessage`, `pushHostEvent`, `buildInitializeResult`, `capabilities` и MUST NOT обращаться к транспорту, DOM или изменяемому состоянию.

#### Scenario: Один и тот же вход даёт один и тот же выход
- **WHEN** `handleWidgetMessage` вызывается дважды с одинаковым сообщением
- **THEN** результаты структурно равны

### Requirement: Перевод сообщений виджета в действия
`McpAppsAdapter.handleWidgetMessage` SHALL переводить: `ui/initialize` → `{ type: 'initialize' }`; `tools/call` → `{ type: 'tool-call', toolName, args }`; `resources/read` → `{ type: 'resource-read', uri }`; `ui/notifications/size-changed` → `{ type: 'size-changed', width?, height? }`; прочие методы → `{ type: 'unsupported', method }`. Действия MUST NOT содержать идентификатор запроса: отвечать по исходному `id` — обязанность моста.

#### Scenario: Вызов инструмента
- **WHEN** приходит `tools/call` с `{ name: 'get_metrics', arguments: { q: 1 } }`
- **THEN** действие равно `{ type: 'tool-call', toolName: 'get_metrics', args: { q: 1 } }`

#### Scenario: Неизвестный метод
- **WHEN** приходит запрос с методом `wat/ever`
- **THEN** действие равно `{ type: 'unsupported', method: 'wat/ever' }`

### Requirement: Валидация параметров
Для методов со схемой параметров адаптер SHALL проверять `params` соответствующей zod-схемой и при неуспехе возвращать `{ type: 'invalid-params', method, error }`, где `error` — читаемый список проблем вида `путь: сообщение`, называющий поле.

#### Scenario: tools/call без имени
- **WHEN** приходит `tools/call` с `{ arguments: {} }`
- **THEN** действие имеет тип `invalid-params`
- **AND** `error` упоминает поле `name`

#### Scenario: size-changed со строкой
- **WHEN** приходит `size-changed` с `{ width: 'wide' }`
- **THEN** действие имеет тип `invalid-params` и `method` равен имени метода

### Requirement: События хоста в wire-уведомления
`pushHostEvent({ type: 'context-changed', context })` SHALL возвращать уведомление `ui/notifications/host-context-changed` с `params`, равным переданному патчу контекста. Для неизвестных событий SHALL возвращаться `null`.

#### Scenario: Смена темы
- **WHEN** хост публикует `{ type: 'context-changed', context: { theme: 'dark' } }`
- **THEN** возвращается `{ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } }`

### Requirement: Результат инициализации
`buildInitializeResult(ctx)` SHALL возвращать объект с `protocolVersion` (константа протокола), `hostCapabilities`, `hostInfo: { name: 'mcp-apps-studio', version }` и `hostContext: ctx`.

#### Scenario: Контекст по умолчанию
- **WHEN** вызывается с `defaultHostContext`
- **THEN** `hostContext.theme === 'light'`, `locale === 'en'`, `displayMode === 'inline'`

### Requirement: Окружение iframe
`buildIframeEnv` SHALL возвращать для источника `resource` режим `srcdoc` с HTML, для источника `dev` — режим `src` с URL; в обоих случаях `sandbox` равен `['allow-scripts']`. Значение `allow-same-origin` MUST NOT появляться в `sandbox`. Опциональное поле `csp` передаётся в атрибут `csp` iframe (работает только в Chromium).

#### Scenario: Виджет из ресурса
- **WHEN** источник `{ kind: 'resource', uri, html }`
- **THEN** окружение равно `{ mode: 'srcdoc', content: html, sandbox: ['allow-scripts'] }`

#### Scenario: Dev-виджет по URL
- **WHEN** источник `{ kind: 'dev', url }`
- **THEN** окружение равно `{ mode: 'src', content: url, sandbox: ['allow-scripts'] }`

### Requirement: Возможности хоста
`capabilities()` SHALL перечислять поддерживаемые режимы отображения `inline`, `fullscreen`, `pip`. UI студии SHALL строить селектор режимов из этого списка.

#### Scenario: Селектор режимов
- **WHEN** студия рендерит панель управления
- **THEN** список опций «Display» совпадает с `adapter.capabilities().displayModes`
