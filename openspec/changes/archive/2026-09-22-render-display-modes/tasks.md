# Tasks

## 1. Layout model

- [x] 1.1 `viewport.ts`: `DEVICES`, `frameSize`, `containerDimensions`, `deviceContext` — verify in `viewport.test.ts`
- [x] 1.2 Store: `device` + `setDevice`, initial context includes the desktop preset — verify in `store.test.ts`

## 2. Canvas and controls

- [x] 2.1 Canvas: wire `onSizeChanged`, measure the canvas, size the frame, sync the context patch only on change; pip/fullscreen styles — verify via e2e
- [x] 2.2 "Device" selector from `DEVICES` keys — verify via e2e

## 3. Verification

- [x] 3.1 e2e: reported height applied, fullscreen fills the canvas, mobile preset reaches the widget — verify `pnpm e2e`
- [x] 3.2 `openspec validate --all --strict`, `pnpm test`, `pnpm typecheck`, `pnpm lint`; archive
