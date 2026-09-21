# Справочный сервер (example-server)

## Purpose

`@studio/example-server` — эталонный MCP Apps сервер на публичных SDK, намеренно без workspace-зависимостей: его можно скопировать как отправную точку. Даёт один инструмент и один UI-ресурс; его `kpi-card.html` одновременно служит демо-виджетом студии.

## Requirements

### Requirement: Без workspace-зависимостей
Пакет MUST NOT зависеть от других пакетов монорепо; допустимы только `@modelcontextprotocol/sdk`, `@modelcontextprotocol/ext-apps`, `express`, `zod`.

#### Scenario: Копирование в чужой проект
- **WHEN** каталог пакета копируется вне монорепо
- **THEN** `pnpm install && pnpm dev` работает без правок импортов

### Requirement: Инструмент get_metrics
Сервер SHALL регистрировать `get_metrics` с `_meta.ui.resourceUri`, указывающим на UI-ресурс, и возвращать одновременно текстовый `content` (обязательный fallback для хостов без UI) и `structuredContent: { value, delta, label }`.

#### Scenario: Вызов инструмента
- **WHEN** клиент вызывает `get_metrics`
- **THEN** `structuredContent` содержит числовые `value`, `delta` и строковый `label`
- **AND** `content[0].text` содержит `Monthly active users`

### Requirement: UI-ресурс
Сервер SHALL отдавать `ui://example/kpi-card.html` с MIME `text/html;profile=mcp-app`, читая HTML из файла рядом с исходником.

#### Scenario: Чтение ресурса
- **WHEN** клиент читает `ui://example/kpi-card.html`
- **THEN** `mimeType` равен константе SDK `RESOURCE_MIME_TYPE`, текст содержит `ui/initialize`

### Requirement: Один файл виджета
`kpi-card.html` SHALL экспортироваться как `./kpi-card.html` и быть единственным источником демо-виджета студии; MUST NOT существовать второй копии этого файла в репозитории.

#### Scenario: Правка виджета
- **WHEN** меняется `kpi-card.html`
- **THEN** изменение видно и в live-режиме, и в демо-режиме `vite dev`

### Requirement: Stateless HTTP с CORS
`main.ts` SHALL поднимать express на `PORT` (по умолчанию 3100), отдавать `/health`, для каждого `POST /mcp` создавать новые `McpServer` и `StreamableHTTPServerTransport` без session id, и выставлять CORS-заголовки, включая `mcp-session-id` и `mcp-protocol-version`, чтобы студия с другого origin могла подключиться.

#### Scenario: Preflight из браузера
- **WHEN** приходит `OPTIONS /mcp`
- **THEN** статус `204` с заголовками `Access-Control-Allow-*`
