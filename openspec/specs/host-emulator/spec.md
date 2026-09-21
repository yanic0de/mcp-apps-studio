# Эмулятор хоста

## Purpose

`HostEmulator` — единственный оркестратор с состоянием в ядре. Он собирает мост, адаптер, роутер моков и таблицу ресурсов, хранит текущий `HostContext` и превращает семантические действия адаптера в ответы: результат инициализации, вызов мока, чтение ресурса, ошибки протокола. Всё, что реальный хост делает с виджетом, воспроизводится здесь.

## Requirements

### Requirement: Ответ на инициализацию
При действии `initialize` эмулятор SHALL вернуть результат `adapter.buildInitializeResult(текущий контекст)`.

#### Scenario: Handshake виджета
- **WHEN** виджет отправляет `ui/initialize`
- **THEN** ответ содержит `protocolVersion` и `hostContext` с текущей темой

### Requirement: Вызовы инструментов через роутер моков
При действии `tool-call` эмулятор SHALL делегировать `MockRouter.call(toolName, args)` и вернуть его результат как JSON-RPC `result`; `RpcError` из роутера SHALL стать JSON-RPC `error`.

#### Scenario: Статический мок
- **WHEN** сценарий содержит `get_metrics: { kind: 'static', result: { rows: [1, 2] } }`
- **THEN** ответ на `tools/call get_metrics` равен `{ rows: [1, 2] }`

#### Scenario: Мок-ошибка
- **WHEN** сценарий содержит `get_metrics: { kind: 'error', error: { code: -32000, message: 'db down' } }`
- **THEN** ответ содержит `error: { code: -32000, message: 'db down' }`

### Requirement: Чтение ресурсов
При действии `resource-read` эмулятор SHALL вернуть `{ contents: [{ uri, mimeType, text }] }` из таблицы `resources`, а для неизвестного `uri` — ошибку `RESOURCE_NOT_FOUND` (-32002).

#### Scenario: Известный ресурс
- **WHEN** `resources` содержит `'ui://kpi': '<html>kpi</html>'` и виджет читает `ui://kpi`
- **THEN** `contents[0]` содержит этот `uri` и `text`

#### Scenario: Неизвестный ресурс
- **WHEN** виджет читает `ui://ghost`
- **THEN** ответ содержит ошибку с кодом `-32002`

### Requirement: Ошибки протокола
Действие `invalid-params` SHALL превращаться в ошибку `INVALID_PARAMS` (-32602) с текстом проблем, `unsupported` — в `METHOD_NOT_FOUND` (-32601). Действие, не имеющее смысла для запроса (например `size-changed`), SHALL давать `INTERNAL_ERROR`.

#### Scenario: Некорректные параметры вызова
- **WHEN** виджет отправляет `tools/call` без `name`
- **THEN** ответ содержит `error.code === -32602`

#### Scenario: Неподдерживаемый метод
- **WHEN** виджет отправляет запрос `wat/ever`
- **THEN** ответ содержит `error.code === -32601`

### Requirement: Уведомления виджета
Уведомление `size-changed` SHALL вызывать `onSizeChanged({ width, height })`. Поскольку у уведомлений нет канала ответа, `invalid-params` и `unsupported` для уведомлений SHALL попадать в трассу событием `kind: 'invalid'` с `method` и причиной, а `onSizeChanged` MUST NOT вызываться.

#### Scenario: Корректный размер
- **WHEN** виджет уведомляет `size-changed` с `{ width: 320, height: 240 }`
- **THEN** `onSizeChanged` получает `{ width: 320, height: 240 }`

#### Scenario: Размер с некорректными параметрами
- **WHEN** виджет уведомляет `size-changed` с `{ width: 'wide' }`
- **THEN** в трассе ровно одно событие `invalid` с `method: 'ui/notifications/size-changed'`
- **AND** `onSizeChanged` не вызывается

#### Scenario: Неизвестное уведомление
- **WHEN** виджет отправляет уведомление `wat/notification`
- **THEN** в трассе появляется событие `invalid` с этим методом

### Requirement: Контекст хоста
Эмулятор SHALL хранить `HostContext` (по умолчанию `defaultHostContext`), а `setHostContext(patch)` SHALL слить патч в текущий контекст и отправить виджету уведомление, полученное от `adapter.pushHostEvent`.

#### Scenario: Смена темы
- **WHEN** вызывается `setHostContext({ theme: 'dark' })`
- **THEN** виджет получает `ui/notifications/host-context-changed` с `params: { theme: 'dark' }`
- **AND** `getHostContext().theme === 'dark'`

### Requirement: Смена моков на лету
`setMocks(config)` SHALL заменить конфигурацию роутера без пересоздания эмулятора.

#### Scenario: Новый сценарий
- **WHEN** после `setMocks` виджет вызывает инструмент
- **THEN** ответ определяется новой конфигурацией

### Requirement: Устойчивость к мусору
Эмулятор SHALL продолжать обслуживать корректные запросы после получения невалидных сообщений.

#### Scenario: Мусор, затем запрос
- **WHEN** транспорт доставляет `{ totally: 'garbage' }`, затем корректный `tools/call`
- **THEN** в трассе одно событие `invalid`
- **AND** `tools/call` получает результат мока
