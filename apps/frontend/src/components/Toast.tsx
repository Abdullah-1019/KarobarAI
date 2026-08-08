import { message } from 'antd';

// Thin wrapper over AntD's message API so features call one shared toast shell instead of
// importing `message` from antd directly everywhere.
export const toast = {
  success: (content: string) => message.success(content),
  error: (content: string) => message.error(content),
  info: (content: string) => message.info(content),
  warning: (content: string) => message.warning(content),
};
