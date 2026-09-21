# Транспорт iframe

## Purpose

`IframeTransport` — единственная точка ядра, касающаяся DOM. Он связывает `MessageBridge` с sandboxed iframe через `postMessage`. Виджет в песочнике имеет null-origin, поэтому фильтровать по origin невозможно; единственный признак доверия — источник события.

## Requirements

### Requirement: Единственный признак доверия
Транспорт SHALL принимать входящее `message`-событие только если `event.source === iframe.contentWindow`. Сообщения от любых других окон MUST быть проигнорированы без логирования.

#### Scenario: Сообщение из другого окна
- **WHEN** событие `message` приходит с `source`, не равным `contentWindow`
- **THEN** обработчики транспорта не вызываются

#### Scenario: Сообщение из виджета
- **WHEN** событие `message` приходит с `source === iframe.contentWindow`
- **THEN** каждый зарегистрированный обработчик получает `event.data`

### Requirement: Отправка с targetOrigin '*'
`send` SHALL вызывать `iframe.contentWindow.postMessage(message, '*')`, так как null-origin песочницы не совпадает ни с одним конкретным origin. Если `contentWindow` отсутствует, вызов SHALL быть безопасным no-op.

#### Scenario: iframe ещё не смонтирован
- **WHEN** `send` вызывается при `contentWindow === null`
- **THEN** исключение не выбрасывается

### Requirement: Инжектируемое окно-слушатель
Конструктор SHALL принимать `ListeningWindow` (по умолчанию глобальный `window`), чтобы транспорт тестировался в node фейком.

#### Scenario: Тест в node
- **WHEN** транспорт создан с фейковым окном
- **THEN** подписка и отписка происходят на фейке, глобальный `window` не требуется

### Requirement: Освобождение ресурсов
`dispose()` SHALL снять слушатель с окна и очистить обработчики; `onMessage` SHALL возвращать функцию отписки конкретного обработчика.

#### Scenario: Смена сценария в студии
- **WHEN** Canvas размонтирует iframe и вызывает `dispose()`
- **THEN** последующие события `message` не доходят до старого моста

### Requirement: Песочница без allow-same-origin
Атрибут `sandbox` iframe SHALL содержать только `allow-scripts`. Значение `allow-same-origin` MUST NOT добавляться: оно даёт виджету origin студии и обнуляет проверку источника.

#### Scenario: Рендер виджета
- **WHEN** Canvas строит iframe из `adapter.buildIframeEnv()`
- **THEN** `sandbox="allow-scripts"`
