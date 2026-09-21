# Рантайм виджета

## Purpose

`@studio/widget-runtime` — единственный разрешённый канал общения виджета с хостом. `WidgetClient` выполняет handshake, вызывает инструменты, следит за контекстом хоста; `applyHostContextToDocument` переносит тему и CSS-переменные в документ; React-хуки в подпути `./react` оборачивают клиент для компонентов. Главная точка входа остаётся свободной от React ради vanilla-виджетов.

## Requirements

### Requirement: Handshake
`connect()` SHALL отправить `ui/initialize` с `protocolVersion` (константа протокола) и `appCapabilities: {}`, сохранить `hostContext` из результата и вернуть его.

#### Scenario: Успешная инициализация
- **WHEN** хост отвечает `{ protocolVersion, hostContext: { theme: 'dark', ... } }`
- **THEN** `connect()` резолвится этим контекстом
- **AND** `getHostContext()` возвращает его же

### Requirement: Вызов инструмента
`callTool(name, args?)` SHALL отправить `tools/call` с `{ name, arguments: args ?? {} }` и вернуть `result` ответа. Ответ с `error` SHALL отклонять промис `RpcError` с `code`, `message` и `data` хоста.

#### Scenario: Успешный вызов
- **WHEN** хост отвечает `{ result: { value: 1 } }`
- **THEN** промис резолвится `{ value: 1 }`

#### Scenario: Ошибка инструмента
- **WHEN** хост отвечает `{ error: { code: -32000, message: 'boom' } }`
- **THEN** промис отклоняется экземпляром `RpcError` с `code === -32000`

### Requirement: Таймаут и корреляция
Клиент SHALL коррелировать ответы через `RequestTracker` с префиксом `w`, отклонять запрос по таймауту (по умолчанию 30 000 мс) и MUST NOT срабатывать таймаутом после полученного ответа.

#### Scenario: Нет ответа
- **WHEN** хост не отвечает в течение `requestTimeoutMs`
- **THEN** промис отклоняется ошибкой с текстом `timed out`

#### Scenario: Ответ пришёл раньше таймаута
- **WHEN** ответ получен, затем проходит время больше таймаута
- **THEN** промис остаётся резолвленным, повторного отклонения нет

### Requirement: Сбой отправки
Если `postMessage` бросает исключение (например `DataCloneError` для несериализуемых аргументов), промис вызова SHALL отклоняться этим исключением.

#### Scenario: Функция в аргументах
- **WHEN** `callTool('x', { fn: () => 1 })` и `postMessage` бросает
- **THEN** промис отклоняется с текстом исключения, не дожидаясь таймаута

### Requirement: Контекст хоста
Уведомление `host-context-changed` SHALL сливаться в сохранённый контекст, а подписчики `onHostContextChanged` SHALL получать патч. Функция отписки SHALL прекращать уведомления.

#### Scenario: Смена темы
- **WHEN** после `connect()` приходит `{ params: { theme: 'light' } }`
- **THEN** `getHostContext()` содержит `theme: 'light'` и прежний `locale`
- **AND** подписчик получает `{ theme: 'light' }`

### Requirement: Уведомление о размере
`sendSizeChanged({ width?, height? })` SHALL отправить уведомление `ui/notifications/size-changed` с этими параметрами.

#### Scenario: Виджет сообщает размер
- **WHEN** вызывается `sendSizeChanged({ width: 320, height: 200 })`
- **THEN** хост получает `{ jsonrpc: '2.0', method: 'ui/notifications/size-changed', params: { width: 320, height: 200 } }`

### Requirement: Освобождение клиента
`dispose()` SHALL снять слушатель окна, отклонить ожидающие запросы ошибкой с текстом `disposed` и очистить подписчиков. Запрос на освобождённом клиенте SHALL отклоняться той же ошибкой.

#### Scenario: Вызов во время dispose
- **WHEN** `callTool('slow')` ожидает ответа и вызывается `dispose()`
- **THEN** промис отклоняется ошибкой `/disposed/`
- **AND** слушателей на окне не остаётся

### Requirement: Игнорирование мусора
Невалидные сообщения и ответы с неизвестным id SHALL игнорироваться без исключений.

#### Scenario: Мусор
- **WHEN** приходят `null`, `{ evil: true }`, `{ jsonrpc: '2.0', id: 'unknown', result: 1 }`
- **THEN** исключений нет, контекст остаётся `null`

### Requirement: Тестируемость в node
Конструктор SHALL принимать duck-typed `WidgetWindow` (`addEventListener`, `removeEventListener`, `parent.postMessage`), по умолчанию — глобальный `window`, вычисляемый лениво.

#### Scenario: Импорт в node
- **WHEN** модуль импортируется в node без `window`
- **THEN** импорт не падает; `window` нужен только при создании клиента без аргументов

### Requirement: Применение контекста к документу
`applyHostContextToDocument(ctx, doc?)` SHALL выставить `data-theme` на корневом элементе при наличии `ctx.theme` и установить каждую переменную из `ctx.styles.variables` через `style.setProperty`.

#### Scenario: Тема и переменные
- **WHEN** `ctx = { theme: 'dark', styles: { variables: { '--color-bg': '#111' } } }`
- **THEN** `documentElement.dataset.theme === 'dark'`
- **AND** `--color-bg` равна `#111`

#### Scenario: Пустой патч
- **WHEN** `ctx = {}`
- **THEN** ничего не меняется и исключение не выбрасывается

### Requirement: React-обёртки
Подпуть `./react` SHALL предоставлять `WidgetProvider`, `useWidgetClient` (бросает вне провайдера), `useHostContext` и `useToolCall(name)` с полями `data`, `error`, `loading`, `call`. Главная точка входа `.` MUST NOT импортировать React.

#### Scenario: Хук вне провайдера
- **WHEN** `useWidgetClient()` вызывается без `WidgetProvider`
- **THEN** выбрасывается ошибка с текстом про `<WidgetProvider>`

### Requirement: Последний вызов побеждает
`useToolCall` (через `createToolCaller`) SHALL гарантировать, что при перекрывающихся вызовах завершение более раннего не перезаписывает состояние более позднего.

#### Scenario: Медленный первый, быстрый второй
- **WHEN** первый `call()` ещё ожидает, второй завершился с данными B
- **THEN** состояние содержит `data: B, loading: false`
- **AND** завершение первого вызова состояние не меняет
