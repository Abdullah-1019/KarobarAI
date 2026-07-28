import { theme as antdTheme, type ThemeConfig } from 'antd';

// AntD ConfigProvider theme — token values ported directly from UIUX doc §11.
// `direction` is NOT set here; it's applied dynamically by ConfigProvider based on language.
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1a6b49',
    colorInfo: '#2c6a93',
    colorSuccess: '#1a6b49',
    colorWarning: '#c77a12',
    colorError: '#b23a2a',
    colorBgLayout: '#fbf8f3',
    colorBgContainer: '#ffffff',
    colorBorder: '#e7e0d5',
    colorText: '#211d17',
    colorTextSecondary: '#6b6358',
    borderRadius: 8,
    borderRadiusLG: 12,
    fontFamily: '"IBM Plex Sans","IBM Plex Sans Arabic",system-ui,sans-serif',
    fontSize: 16,
    controlHeight: 44,
  },
};

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...lightTheme.token,
    colorPrimary: '#3fa877',
    colorBgLayout: '#15130f',
    colorBgContainer: '#1f1c17',
    colorBorder: '#34302a',
    colorText: '#f2eee6',
    colorTextSecondary: '#ada597',
  },
};
