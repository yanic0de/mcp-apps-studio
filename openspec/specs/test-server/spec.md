# Тестовый полигон (test-server)

## Purpose

`@studio/test-server` — MCP-сервер, у которого каждый инструмент проверяет одно поведение эмулятора: круговой обход данных, задержку, ошибку инструмента, пагинацию, состояние между вызовами. Виджет «Protocol Inspector» даёт кнопку на каждый инструмент и показывает сырой JSON ответа. Как и example-server, не зависит от пакетов монорепо.

## Requirements

### Requirement: Набор инструментов
Сервер SHALL регистрировать ровно `echo`, `slow_metrics`, `fail`, `get_rows`, `counter`, каждый с `_meta.ui.resourceUri` на ресурс инспектора.

#### Scenario: Список инструментов
- **WHEN** клиент запрашивает `tools/list`
- **THEN** имена равны `['counter', 'echo', 'fail', 'get_rows', 'slow_metrics']`

### Requirement: echo
`echo({ message = 'ping' })` SHALL вернуть `structuredContent: { echoed: args }`.

#### Scenario: Круговой обход
- **WHEN** вызов с `{ message: 'hello' }`
- **THEN** `structuredContent` равен `{ echoed: { message: 'hello' } }`

### Requirement: slow_metrics
`slow_metrics({ delayMs = 1500 })` SHALL ждать `delayMs` (0…10 000) и вернуть метрики с `label`, упоминающим задержку.

#### Scenario: Нулевая задержка
- **WHEN** вызов с `{ delayMs: 0 }`
- **THEN** ответ содержит числовое `value` и строковый `label`

### Requirement: fail
`fail({ message = 'Intentional failure' })` SHALL вернуть `isError: true` с этим текстом в `content`.

#### Scenario: Ошибка инструмента доходит до виджета
- **WHEN** инспектор нажимает `fail` в live-режиме
- **THEN** виджет показывает `Intentional failure` в состоянии ошибки

### Requirement: get_rows
`get_rows({ page = 1, pageSize = 10 })` SHALL возвращать детерминированные строки `Row N` из 42, `columns`, `total: 42`, `page`.

#### Scenario: Вторая страница
- **WHEN** вызов с `{ page: 2, pageSize: 5 }`
- **THEN** строки `Row 6` … `Row 10`, `total === 42`

### Requirement: counter
`counter({ by = 1 })` SHALL инкрементировать значение на уровне модуля, переживающее stateless-инстансы сервера на каждый запрос.

#### Scenario: Два вызова через HTTP
- **WHEN** два последовательных `POST /mcp` с `counter`
- **THEN** второй `count` на `by` больше первого

### Requirement: Виджет-инспектор
Ресурс `ui://test/inspector.html` (MIME `text/html;profile=mcp-app`) SHALL содержать кнопку на каждый инструмент и вывод сырого запроса и ответа; ошибка SHALL выделяться классом `error`.

#### Scenario: Использование из студии
- **WHEN** студия открыта с `?server=http://localhost:3200/mcp` и выбран `live`
- **THEN** заголовок виджета содержит `Protocol Inspector`, кнопки вызывают инструменты через passthrough

### Requirement: HTTP как у example-server
`main.ts` SHALL повторять схему example-server (express, CORS, `/health`, stateless `POST /mcp`) на порту 3200. Это намеренная копия: оба пакета остаются без общих зависимостей.

#### Scenario: Health
- **WHEN** запрос `GET /health`
- **THEN** ответ `{ ok: true }`
