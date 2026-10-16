import { theme as antdTheme, type ThemeConfig } from 'antd';

// AntD ConfigProvider theme — token values ported directly from UIUX doc §11.
// `direction` is NOT set here; it's applied dynamically by ConfigProvider based on language.

// Shared across both themes — doesn't vary with light/dark palette values.
const sharedComponents: NonNullable<ThemeConfig['components']> = {
  // Modal alone needs --radius-lg (16); Card is already correct at 12/--radius-md by default,
  // so this is scoped to Modal only rather than shifting borderRadiusLG's other consumers.
  Modal: { borderRadiusLG: 16 },
  // Buyer-journey controls (Batch 1): brand-tinted slider/segmented/tooltip so filter + sort +
  // quantity controls read as designed, not default AntD.
  Segmented: { itemSelectedBg: '#0b6e4f', itemSelectedColor: '#ffffff', borderRadius: 999 },
  Tooltip: { borderRadius: 8 },
};

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0b6e4f',
    colorInfo: '#2c6a93',
    colorSuccess: '#1e9e6a',
    colorWarning: '#c77a12',
    colorError: '#d64545',
    colorBgLayout: '#fbf8f3',
    colorBgContainer: '#ffffff',
    colorBorder: '#e8e2d6',
    colorText: '#1a2b25',
    colorTextSecondary: '#5f6f68',
    borderRadius: 12,
    borderRadiusLG: 12,
    fontFamily: '"Inter","IBM Plex Sans Arabic",system-ui,sans-serif',
    fontSize: 16,
    controlHeight: 48,
  },
  components: {
    ...sharedComponents,
    // UIUX §12 "Secondary" button: outline (green border, green text, transparent bg) — AntD's
    // own default button token defaults to colorText/colorBorder (a neutral grey outline), which
    // is exactly the "reads as templated AntD" gap §33 warns about. Scoped to Button only.
    Button: {
      defaultColor: '#0b6e4f',
      defaultBorderColor: '#0b6e4f',
      defaultHoverColor: '#095e43',
      defaultHoverBorderColor: '#095e43',
      defaultActiveColor: '#064e38',
      defaultActiveBorderColor: '#064e38',
    },
    Slider: {
      trackBg: '#0b6e4f',
      trackHoverBg: '#095e43',
      handleColor: '#0b6e4f',
      handleActiveColor: '#095e43',
      handleSize: 16,
      handleSizeHover: 18,
      railBg: '#e8e2d6',
    },
  },
};

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...lightTheme.token,
    colorPrimary: '#2dbe8a',
    colorBgLayout: '#0f1a16',
    colorBgContainer: '#16251f',
    colorBorder: '#263a32',
    colorText: '#eaf2ee',
    colorTextSecondary: '#a9b8b2',
  },
  components: {
    ...sharedComponents,
    // Dark mode defines only one brand green (no separate hover/active shades) — reused as-is for
    // hover/active rather than inventing an undocumented tint; AntD's own hover/active background
    // tint still provides feedback on top of this.
    Button: {
      defaultColor: '#2dbe8a',
      defaultBorderColor: '#2dbe8a',
      defaultHoverColor: '#2dbe8a',
      defaultHoverBorderColor: '#2dbe8a',
      defaultActiveColor: '#2dbe8a',
      defaultActiveBorderColor: '#2dbe8a',
    },
    Slider: {
      trackBg: '#2dbe8a',
      trackHoverBg: '#2dbe8a',
      handleColor: '#2dbe8a',
      handleActiveColor: '#2dbe8a',
      handleSize: 16,
      handleSizeHover: 18,
      railBg: '#263a32',
    },
  },
};
