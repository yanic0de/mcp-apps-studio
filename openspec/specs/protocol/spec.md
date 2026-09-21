# Протокол MCP Apps (SEP-1865)

## Purpose

Единственный источник правды о wire-уровне расширения MCP Apps: версия протокола, MIME-тип UI-ресурса, имена JSON-RPC-методов и схемы их параметров. Все остальные пакеты берут эти значения из `packages/shared/src/protocol.ts`; при эволюции спецификации меняется только этот файл.

## Requirements

### Requirement: Версия протокола и MIME-тип ресурса
Пакет `@studio/shared` SHALL экспортировать константу версии протокола `2026-01-26` и MIME-тип UI-ресурса `text/html;profile=mcp-app`, и все места, где эти значения нужны (ответ `ui/initialize`, обнаружение ресурса в live-режиме), SHALL использовать эти константы, а не литералы.

#### Scenario: Ответ на инициализацию несёт версию
- **WHEN** виджет отправляет `ui/initialize`
- **THEN** поле `protocolVersion` в результате равно константе `MCP_APPS_PROTOCOL_VERSION`

#### Scenario: Обнаружение виджета по MIME
- **WHEN** студия в live-режиме получает список ресурсов сервера
- **THEN** ресурсом виджета считается тот, чей `mimeType` равен `MCP_APPS_RESOURCE_MIME`

### Requirement: Имена методов в одном месте
Имена wire-методов SHALL храниться только в объекте `MCP_APPS_METHODS`: от виджета к хосту — `ui/initialize`, `tools/call`, `resources/read`, `ui/notifications/size-changed`; от хоста к виджету — `ui/notifications/host-context-changed`, `ui/notifications/tool-input`. Код вне `protocol.ts` MUST NOT содержать эти строки литералами.

#### Scenario: Смена имени метода в спецификации
- **WHEN** имя метода меняется в новой версии SEP-1865
- **THEN** достаточно изменить значение в `MCP_APPS_METHODS`
- **AND** адаптер, клиент виджета и тесты продолжают ссылаться на то же поле

### Requirement: Схемы параметров методов
Пакет SHALL предоставлять zod-схемы параметров: `tools/call` — `{ name: непустая строка, arguments?: unknown }`; `resources/read` — `{ uri: непустая строка }`; `size-changed` — `{ width?: number, height?: number }`.

#### Scenario: Пустое имя инструмента
- **WHEN** параметры `tools/call` содержат `name: ""`
- **THEN** `toolsCallParamsSchema.safeParse` возвращает неуспех

#### Scenario: Размер без одного измерения
- **WHEN** параметры `size-changed` содержат только `height`
- **THEN** схема принимает их, `width` остаётся `undefined`

### Requirement: Follow-up-сообщения виджета не реализуются по памяти
Адаптер MUST NOT содержать метод для follow-up-сообщений виджета, пока его wire-имя не подтверждено реальным SDK `@modelcontextprotocol/ext-apps`.

#### Scenario: Виджет отправляет неизвестный метод
- **WHEN** виджет отправляет запрос с методом, отсутствующим в `MCP_APPS_METHODS`
- **THEN** хост отвечает ошибкой `METHOD_NOT_FOUND`, а не пытается угадать семантику
