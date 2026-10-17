import { theme as antdTheme, type ThemeConfig } from 'antd';

import { fonts, haveli, haveliNight } from './palette';

// AntD ConfigProvider theme — the Haveli palette (palette.ts) mapped onto AntD's tokens, so every
// AntD table, form, modal, tab and slider across the app matches the CSS-variable world in
// global.css. No hex literals here: change colours in palette.ts.
// `direction` is NOT set here; it's applied dynamically by ConfigProvider based on language.

const RING = `0 0 0 3px ${haveli.copperRing}`; // copper focus halo, matches --brand-ring

const lightComponents: NonNullable<ThemeConfig['components']> = {
  Modal: { borderRadiusLG: 16, contentBg: haveli.cream, headerBg: haveli.cream },
  Tooltip: { borderRadius: 8, colorBgSpotlight: haveli.espresso },
  // Default (secondary) buttons: espresso outline that warms to copper on hover — AntD's own
  // default is a neutral grey outline, the most "templated AntD" tell there is.
  Button: {
    defaultColor: haveli.espresso,
    defaultBg: 'transparent',
    defaultBorderColor: haveli.clay,
    defaultHoverColor: haveli.copperDeep,
    defaultHoverBorderColor: haveli.copper,
    defaultHoverBg: haveli.peachClay,
    defaultActiveColor: haveli.copperDeeper,
    defaultActiveBorderColor: haveli.copperDeeper,
    primaryShadow: 'none',
    defaultShadow: 'none',
    dangerShadow: 'none',
    fontWeight: 600,
  },
  Segmented: {
    itemSelectedBg: haveli.espresso,
    itemSelectedColor: haveli.parchment,
    itemColor: haveli.umber,
    itemHoverColor: haveli.espresso,
    trackBg: haveli.sand,
    borderRadius: 999,
  },
  Slider: {
    trackBg: haveli.copper,
    trackHoverBg: haveli.copperDeep,
    handleColor: haveli.copper,
    handleActiveColor: haveli.copperDeep,
    dotActiveBorderColor: haveli.copper,
    handleSize: 16,
    handleSizeHover: 18,
    railBg: haveli.linen,
    railHoverBg: haveli.clay,
  },
  Tabs: {
    inkBarColor: haveli.copper,
    itemColor: haveli.umber,
    itemHoverColor: haveli.espresso,
    itemSelectedColor: haveli.espresso,
    itemActiveColor: haveli.copperDeeper,
    titleFontSize: 15,
  },
  Table: {
    headerBg: haveli.sand,
    headerColor: haveli.walnut,
    headerSplitColor: haveli.linen,
    borderColor: haveli.linen,
    rowHoverBg: haveli.parchment,
    rowSelectedBg: haveli.peachClay,
    rowSelectedHoverBg: haveli.peachClay,
    headerSortActiveBg: haveli.linen,
    headerSortHoverBg: haveli.linen,
    bodySortBg: haveli.parchment,
  },
  Tag: { defaultBg: haveli.sand, defaultColor: haveli.walnut },
  // Fields: sand fill + clay hairline at rest (clearly a field on cream cards), cream + copper
  // ring when focused.
  Input: {
    colorBgContainer: haveli.sand,
    colorBorder: haveli.clay,
    activeBorderColor: haveli.copper,
    hoverBorderColor: haveli.taupe,
    activeShadow: RING,
    activeBg: haveli.cream,
    hoverBg: haveli.sand,
  },
  InputNumber: { colorBgContainer: haveli.sand, colorBorder: haveli.clay, activeShadow: RING },
  Select: {
    colorBgContainer: haveli.sand,
    colorBorder: haveli.clay,
    optionSelectedBg: haveli.peachClay,
    optionSelectedColor: haveli.espresso,
    optionActiveBg: haveli.parchment,
  },
  DatePicker: {
    colorBgContainer: haveli.sand,
    colorBorder: haveli.clay,
    activeBorderColor: haveli.copper,
    hoverBorderColor: haveli.clay,
    activeShadow: RING,
  },
  Card: { colorBorderSecondary: haveli.linen, headerFontSize: 18, borderRadiusLG: 16 },
  Pagination: { itemActiveBg: haveli.peachClay },
  Steps: { dotSize: 10 },
  Drawer: { colorBgElevated: haveli.cream },
  Badge: { colorError: haveli.copper },
  Progress: { defaultColor: haveli.copper, remainingColor: haveli.sand },
  Switch: { handleBg: haveli.cream },
  Alert: { withDescriptionPadding: '16px 20px' },
};

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: haveli.copper,
    colorLink: haveli.copper,
    colorLinkHover: haveli.copperDeep,
    colorLinkActive: haveli.copperDeeper,
    colorInfo: haveli.indigo,
    colorSuccess: haveli.moss,
    colorWarning: haveli.turmericInk,
    colorError: haveli.kiln,
    colorBgLayout: haveli.parchment,
    colorBgContainer: haveli.cream,
    colorBgElevated: haveli.cream,
    colorFillAlter: haveli.parchment,
    colorFillSecondary: haveli.sand,
    colorBorder: haveli.linen,
    colorBorderSecondary: haveli.linen,
    colorSplit: haveli.linen,
    colorText: haveli.espresso,
    colorTextHeading: haveli.espresso,
    colorTextSecondary: haveli.umber,
    colorTextTertiary: haveli.taupe,
    colorTextDescription: haveli.umber,
    colorTextPlaceholder: haveli.taupe,
    controlOutline: haveli.copperRing,
    controlItemBgActive: haveli.peachClay,
    controlItemBgHover: haveli.parchment,
    borderRadius: 12,
    borderRadiusLG: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    controlHeight: 48,
    boxShadowSecondary: `0 14px 36px ${haveli.espressoShadow}`,
  },
  components: lightComponents,
};

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...lightTheme.token,
    colorPrimary: haveliNight.copper,
    colorLink: haveliNight.copper,
    colorLinkHover: haveliNight.copperHover,
    colorLinkActive: haveliNight.copperActive,
    colorSuccess: haveliNight.success,
    colorWarning: haveliNight.brass,
    colorError: haveliNight.error,
    colorInfo: haveliNight.info,
    colorBgLayout: haveliNight.canvas,
    colorBgContainer: haveliNight.surface,
    colorBgElevated: haveliNight.surface,
    colorFillAlter: haveliNight.sunken,
    colorFillSecondary: haveliNight.sunken,
    colorBorder: haveliNight.border,
    colorBorderSecondary: haveliNight.border,
    colorSplit: haveliNight.border,
    colorText: haveliNight.text,
    colorTextHeading: haveliNight.text,
    colorTextSecondary: haveliNight.textSecondary,
    colorTextTertiary: haveliNight.textSecondary,
    colorTextDescription: haveliNight.textSecondary,
    colorTextPlaceholder: haveliNight.textSecondary,
    controlItemBgActive: haveliNight.sunken,
    controlItemBgHover: haveliNight.sunken,
  },
  // Dark mode polish is deferred (WORKLOG.md): only the components whose light values would
  // glare on night surfaces are overridden; the rest follow AntD's dark algorithm.
  components: {
    Modal: { borderRadiusLG: 16 },
    Tooltip: { borderRadius: 8 },
    Segmented: { itemSelectedBg: haveliNight.copper, itemSelectedColor: haveliNight.canvas, borderRadius: 999 },
    Slider: {
      trackBg: haveliNight.copper,
      trackHoverBg: haveliNight.copperHover,
      handleColor: haveliNight.copper,
      handleActiveColor: haveliNight.copperHover,
      handleSize: 16,
      handleSizeHover: 18,
      railBg: haveliNight.border,
    },
    Tabs: { inkBarColor: haveliNight.copper, itemSelectedColor: haveliNight.text },
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 600 },
  },
};

/**
 * Compact density for the Seller and Admin workspaces (Operate surfaces): denser tables and forms
 * than the buyer storefront's 48px touch-first controls. Applied by AppShell's `density` prop as a
 * nested ConfigProvider, which merges over the light/dark theme above. Desktop/tablet only:
 * AppShell keeps the 48px default on phones so touch targets never drop below the 44px floor.
 */
export const compactDensity: ThemeConfig = {
  token: { controlHeight: 40, fontSize: 15 },
};
