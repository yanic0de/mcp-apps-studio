# Моки инструментов

## Purpose

Сценарий студии — это набор моков: как эмулятор отвечает на `tools/call` каждого инструмента. `toolMockSchema` в `@studio/shared` — единственный источник и для TypeScript-типа, и для валидации story-файлов. `MockRouter` в `host-emulator` исполняет конфигурацию; его `passthrough`-обработчик — точка подключения реального MCP-клиента.

## Requirements

### Requirement: Виды моков
Схема `toolMockSchema` SHALL допускать ровно три вида, различаемых полем `kind`: `static` (`result: unknown`, `delayMs?`), `error` (`error: { code: целое, message: строка }`, `delayMs?`), `passthrough` (без полей). `delayMs` SHALL быть целым неотрицательным числом.

#### Scenario: Опечатка в kind
- **WHEN** мок содержит `kind: 'statik'`
- **THEN** схема отклоняет его, и текст ошибки называет поле `kind`

#### Scenario: Отрицательная задержка
- **WHEN** мок содержит `delayMs: -5` или `delayMs: 1.5`
- **THEN** схема отклоняет его

#### Scenario: Результат null
- **WHEN** мок `{ kind: 'static', result: null }`
- **THEN** схема принимает его, сохраняя `result: null`

### Requirement: Конфигурация по именам инструментов
`mockConfigSchema` SHALL быть словарём «имя инструмента → мок» и при ошибке SHALL указывать имя инструмента в пути проблемы.

#### Scenario: Сломан один инструмент
- **WHEN** конфигурация `{ ok: { kind: 'passthrough' }, bad: { kind: 'error', error: {} } }`
- **THEN** ошибка содержит путь `bad.error.`

### Requirement: Исполнение статического мока
`MockRouter.call` SHALL дождаться `delayMs` (если задано) и вернуть `result`.

#### Scenario: Задержка для состояния загрузки
- **WHEN** мок `{ kind: 'static', result: 1, delayMs: 3_600_000 }`
- **THEN** промис не резолвится в течение часа, и виджет остаётся в состоянии загрузки

### Requirement: Исполнение мока-ошибки
Для мока `error` роутер SHALL, дождавшись `delayMs`, бросить `RpcError` с указанными `code` и `message`.

#### Scenario: Ошибка бэкенда
- **WHEN** мок `{ kind: 'error', error: { code: -32000, message: 'Metrics backend unavailable' } }`
- **THEN** `call` отклоняется `RpcError(-32000, 'Metrics backend unavailable')`

### Requirement: Passthrough
Если для инструмента нет мока или мок имеет вид `passthrough`, роутер SHALL вызвать обработчик `passthrough(toolName, args)`. При отсутствии обработчика SHALL бросаться `RpcError(METHOD_NOT_FOUND)` с текстом, называющим инструмент.

#### Scenario: Live-режим
- **WHEN** сценарий `live` с пустыми моками и подключённым MCP-сервером
- **THEN** каждый `tools/call` проксируется в реальный сервер через обработчик

#### Scenario: Нет ни мока, ни обработчика
- **WHEN** инструмент `unknown_tool` не описан, а passthrough не задан
- **THEN** `call` отклоняется ошибкой `-32601` с упоминанием `unknown_tool`
