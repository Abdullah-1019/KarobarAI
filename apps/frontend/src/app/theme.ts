import { theme as antdTheme, type ThemeConfig } from 'antd';

// AntD ConfigProvider theme — token values ported directly from UIUX doc §11.
// `direction` is NOT set here; it's applied dynamically by ConfigProvider based on language.

// Shared across both themes — doesn't vary with light/dark palette values.
const sharedComponents: NonNullable<ThemeConfig['components']> = {
  // Modal alone needs --radius-lg (16); Card is already correct at 12/--radius-md by default,
  // so this is scoped to Modal only rather than shifting borderRadiusLG's other consumers.
  Modal: { borderRadiusLG: 16 },
};

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
  components: {
    ...sharedComponents,
    // UIUX §12 "Secondary" button: outline (green border, green text, transparent bg) — AntD's
    // own default button token defaults to colorText/colorBorder (a neutral grey outline), which
    // is exactly the "reads as templated AntD" gap §33 warns about. Scoped to Button only.
    Button: {
      defaultColor: '#1a6b49',
      defaultBorderColor: '#1a6b49',
      defaultHoverColor: '#15583c',
      defaultHoverBorderColor: '#15583c',
      defaultActiveColor: '#0f4630',
      defaultActiveBorderColor: '#0f4630',
    },
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
  components: {
    ...sharedComponents,
    // UIUX §5.3 only defines one dark-mode green (no separate hover/active shades) — reused as-is
    // for hover/active rather than inventing an undocumented tint; AntD's own hover/active
    // background tint still provides feedback on top of this.
    Button: {
      defaultColor: '#3fa877',
      defaultBorderColor: '#3fa877',
      defaultHoverColor: '#3fa877',
      defaultHoverBorderColor: '#3fa877',
      defaultActiveColor: '#3fa877',
      defaultActiveBorderColor: '#3fa877',
    },
  },
};
