import { message } from 'antd';

// Thin wrapper over AntD's message API so features call one shared toast shell instead of
// importing `message` from antd directly everywhere. UIUX §27 asks for errors to "persist until
// dismissed or offer Retry" — AntD's message API has no true persist-until-click mode (it's
// always click-to-dismiss-early + a timer), so this gives errors/warnings materially longer
// (6s vs. AntD's 3s default) reading time instead, which is the honest amount of this we can do
// without replacing the message API app-wide (40+ existing call sites) for one duration knob.
const ERROR_DURATION_SECONDS = 6;

export const toast = {
  success: (content: string) => message.success(content),
  error: (content: string) => message.error(content, ERROR_DURATION_SECONDS),
  info: (content: string) => message.info(content),
  warning: (content: string) => message.warning(content, ERROR_DURATION_SECONDS),
};
