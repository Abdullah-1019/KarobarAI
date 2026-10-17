import { theme as antdTheme, type ThemeConfig } from 'antd';

import { fonts, studio, studioNight } from './palette';

// AntD ConfigProvider theme — the Studio Light palette (palette.ts) mapped onto AntD's tokens, so
// every AntD table, form, modal, tab and slider across the app matches the CSS-variable world in
// global.css. No hex literals here: change colours in palette.ts.
// `direction` is NOT set here; it's applied dynamically by ConfigProvider based on language.

const RING = `0 0 0 3px ${studio.persimmonRing}`; // persimmon focus halo, matches --brand-ring

const lightComponents: NonNullable<ThemeConfig['components']> = {
  Modal: { borderRadiusLG: 24, contentBg: studio.white, headerBg: studio.white },
  Tooltip: { borderRadius: 8, colorBgSpotlight: studio.ink },
  // Default (secondary) buttons follow the Studio Light outline: white fill, hairline-strong edge,
  // ink text; the edge turns ink on hover (DESIGN-CONSULT §6). AntD primary buttons stay flat — on
  // the dense Seller/Admin tables a coloured glow would be noise; the storefront CTA carries it.
  Button: {
    defaultColor: studio.ink,
    defaultBg: studio.white,
    defaultBorderColor: studio.hairlineStrong,
    defaultHoverColor: studio.ink,
    defaultHoverBorderColor: studio.ink,
    defaultHoverBg: studio.warmWhite,
    defaultActiveColor: studio.ink,
    defaultActiveBorderColor: studio.ink,
    primaryShadow: 'none',
    defaultShadow: 'none',
    dangerShadow: 'none',
    fontWeight: 600,
  },
  Segmented: {
    itemSelectedBg: studio.ink,
    itemSelectedColor: studio.white,
    itemColor: studio.graphite,
    itemHoverColor: studio.ink,
    trackBg: studio.stone,
    borderRadius: 999,
  },
  Slider: {
    trackBg: studio.ink,
    trackHoverBg: studio.ink2,
    handleColor: studio.ink,
    handleActiveColor: studio.ink2,
    dotActiveBorderColor: studio.ink,
    handleSize: 16,
    handleSizeHover: 18,
    railBg: studio.hairline,
    railHoverBg: studio.hairlineStrong,
  },
  Tabs: {
    inkBarColor: studio.ink,
    itemColor: studio.graphite,
    itemHoverColor: studio.ink,
    itemSelectedColor: studio.ink,
    itemActiveColor: studio.ink,
    titleFontSize: 15,
  },
  Table: {
    headerBg: studio.stone,
    headerColor: studio.graphite,
    headerSplitColor: studio.hairline,
    borderColor: studio.hairline,
    rowHoverBg: studio.warmWhite,
    rowSelectedBg: studio.persimmonSoft,
    rowSelectedHoverBg: studio.persimmonSoft,
    headerSortActiveBg: studio.hairline,
    headerSortHoverBg: studio.hairline,
    bodySortBg: studio.warmWhite,
  },
  Tag: { defaultBg: studio.stone, defaultColor: studio.ink2 },
  // Fields: stone fill at rest (reads as a field on white cards and the warm-white page without
  // relying on a faint edge); white + ink edge + persimmon ring when focused.
  Input: {
    colorBgContainer: studio.stone,
    colorBorder: studio.hairlineStrong,
    activeBorderColor: studio.ink,
    hoverBorderColor: studio.mist,
    activeShadow: RING,
    activeBg: studio.white,
    hoverBg: studio.stone,
  },
  InputNumber: {
    colorBgContainer: studio.stone,
    colorBorder: studio.hairlineStrong,
    activeBorderColor: studio.ink,
    hoverBorderColor: studio.mist,
    activeShadow: RING,
  },
  Select: {
    colorBgContainer: studio.stone,
    colorBorder: studio.hairlineStrong,
    // This AntD version has no Select border tokens: its focus edge follows colorPrimary and its
    // hover edge colorPrimaryHover, so they are set here (component scope only) to match Input.
    colorPrimary: studio.ink,
    colorPrimaryHover: studio.mist,
    controlOutline: studio.persimmonRing,
    optionSelectedBg: studio.persimmonSoft,
    optionSelectedColor: studio.ink,
    optionActiveBg: studio.warmWhite,
  },
  DatePicker: {
    colorBgContainer: studio.stone,
    colorBorder: studio.hairlineStrong,
    activeBorderColor: studio.ink,
    hoverBorderColor: studio.mist,
    activeShadow: RING,
    colorPrimary: studio.ink, // selected day / range
  },
  Card: { colorBorderSecondary: studio.hairline, headerFontSize: 18, borderRadiusLG: 24 },
  // Selected / current states are ink, never persimmon (one persimmon per view: DESIGN-CONSULT §6).
  Menu: {
    itemSelectedColor: studio.ink,
    itemSelectedBg: studio.stone,
    itemActiveBg: studio.stone,
    itemHoverBg: studio.warmWhite,
  },
  Steps: { dotSize: 10, colorPrimary: studio.ink },
  Rate: { starColor: studio.ink },
  // Active page: stone with an ink edge and ink number (AntD draws both from colorPrimary).
  Pagination: { itemActiveBg: studio.stone, colorPrimary: studio.ink, colorPrimaryHover: studio.ink2 },
  Drawer: { colorBgElevated: studio.white },
  Badge: { colorError: studio.red },
  Progress: { defaultColor: studio.ink, remainingColor: studio.stone },
  Switch: { handleBg: studio.white, colorPrimary: studio.ink, colorPrimaryHover: studio.ink2 },
  Checkbox: { colorPrimary: studio.ink, colorPrimaryHover: studio.ink2 },
  Radio: { colorPrimary: studio.ink, colorPrimaryHover: studio.ink2 },
  Alert: { withDescriptionPadding: '16px 20px' },
};

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: studio.persimmon,
    colorLink: studio.persimmon,
    colorLinkHover: studio.persimmonDeep,
    colorLinkActive: studio.persimmonDeeper,
    colorInfo: studio.indigo,
    colorSuccess: studio.green,
    colorWarning: studio.amberInk,
    colorError: studio.red,
    colorBgLayout: studio.warmWhite,
    colorBgContainer: studio.white,
    colorBgElevated: studio.white,
    colorFillAlter: studio.warmWhite,
    colorFillSecondary: studio.stone,
    colorBorder: studio.hairline,
    colorBorderSecondary: studio.hairline,
    colorSplit: studio.hairline,
    colorText: studio.ink,
    colorTextHeading: studio.ink,
    colorTextSecondary: studio.graphite,
    colorTextTertiary: studio.slate,
    colorTextDescription: studio.graphite,
    colorTextPlaceholder: studio.graphite,
    controlOutline: studio.persimmonRing,
    controlItemBgActive: studio.persimmonSoft,
    controlItemBgHover: studio.warmWhite,
    borderRadius: 14,
    borderRadiusLG: 16,
    fontFamily: fonts.body,
    fontSize: 16,
    controlHeight: 44,
    // Popovers, dropdowns, tooltips: the two-layer --shadow-lg (DESIGN-CONSULT §5).
    boxShadowSecondary: `0 8px 18px ${studio.inkShadowContact}, 0 22px 44px ${studio.inkShadowAmbient}`,
  },
  components: lightComponents,
};

export const darkTheme: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...lightTheme.token,
    colorPrimary: studioNight.persimmon,
    colorLink: studioNight.persimmon,
    colorLinkHover: studioNight.persimmonHover,
    colorLinkActive: studioNight.persimmonActive,
    colorSuccess: studioNight.success,
    colorWarning: studioNight.amber,
    colorError: studioNight.error,
    colorInfo: studioNight.info,
    colorBgLayout: studioNight.canvas,
    colorBgContainer: studioNight.surface,
    colorBgElevated: studioNight.surface,
    colorFillAlter: studioNight.sunken,
    colorFillSecondary: studioNight.sunken,
    colorBorder: studioNight.border,
    colorBorderSecondary: studioNight.border,
    colorSplit: studioNight.border,
    colorText: studioNight.text,
    colorTextHeading: studioNight.text,
    colorTextSecondary: studioNight.textSecondary,
    colorTextTertiary: studioNight.textSecondary,
    colorTextDescription: studioNight.textSecondary,
    colorTextPlaceholder: studioNight.textSecondary,
    controlItemBgActive: studioNight.sunken,
    controlItemBgHover: studioNight.sunken,
  },
  // Dark mode polish is deferred (DESIGN-CONSULT §2): only the components whose light values would
  // glare on night surfaces are overridden; the rest follow AntD's dark algorithm.
  components: {
    Modal: { borderRadiusLG: 24 },
    Tooltip: { borderRadius: 8 },
    Segmented: { itemSelectedBg: studioNight.text, itemSelectedColor: studioNight.canvas, borderRadius: 999 },
    Slider: {
      trackBg: studioNight.text,
      trackHoverBg: studioNight.textSecondary,
      handleColor: studioNight.text,
      handleActiveColor: studioNight.textSecondary,
      handleSize: 16,
      handleSizeHover: 18,
      railBg: studioNight.border,
    },
    Tabs: { inkBarColor: studioNight.text, itemSelectedColor: studioNight.text },
    Button: { primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none', fontWeight: 600 },
  },
};

/**
 * Compact density for the Seller and Admin workspaces (Operate surfaces): denser tables and forms
 * than the buyer storefront's 44px touch-first controls. Applied by AppShell's `density` prop as a
 * nested ConfigProvider, which merges over the light/dark theme above. Desktop/tablet only:
 * AppShell keeps the 44px default on phones so touch targets never drop below the 44px floor.
 */
export const compactDensity: ThemeConfig = {
  token: { controlHeight: 40, fontSize: 15 },
};
