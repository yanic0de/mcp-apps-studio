import { hostContextSchema } from '@studio/shared';
import { selectActiveWidget, useStudioStore } from './store.js';
import { DEVICES, type Device } from './viewport.js';

/**
 * Applies `?widget=&scenario=&theme=&display=&device=` to the store (after the manifest loaded).
 * Anything that does not name an existing widget/scenario or a valid option is ignored.
 */
export function applyDeepLink(search: string): void {
  const params = new URLSearchParams(search);
  const store = useStudioStore.getState();

  const widget = params.get('widget');
  if (widget && store.widgets.some((w) => w.id === widget)) store.setActiveWidget(widget);

  const scenario = params.get('scenario');
  const active = selectActiveWidget(useStudioStore.getState());
  if (scenario && active && scenario in active.scenarios) store.setScenario(scenario);

  const theme = hostContextSchema.shape.theme.safeParse(params.get('theme'));
  if (theme.success) store.setHostContext({ theme: theme.data });

  const display = hostContextSchema.shape.displayMode.safeParse(params.get('display'));
  if (display.success) store.setHostContext({ displayMode: display.data });

  const device = params.get('device');
  if (device && device in DEVICES) store.setDevice(device as Device);
}
