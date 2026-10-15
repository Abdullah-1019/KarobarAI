import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Importing app/i18n initializes i18next with the real en/ur resources (the store imports it too,
// but importing explicitly documents the dependency and keeps the announcement assertion honest).
import '../../app/i18n';
import { useAuthStore } from '../../lib/authStore';
import { useLanguageStore } from '../../lib/languageStore';
import { LanguageToggle } from './LanguageToggle';

const STORAGE_KEY = 'karobarai:language';

// Tests share the module-level singleton stores, so every test starts from a known baseline.
function resetLanguage() {
  window.localStorage.clear();
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  useLanguageStore.setState({ language: 'EN', dir: 'ltr' });
  useAuthStore.setState({ user: null });
}

describe('LanguageToggle', () => {
  beforeEach(resetLanguage);
  afterEach(resetLanguage);

  it('renders both language labels', () => {
    render(<LanguageToggle />);

    expect(screen.getByRole('radio', { name: 'EN' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'اردو' })).toBeInTheDocument();
  });

  it('switches to Urdu on click and updates the store, <html> and localStorage', () => {
    render(<LanguageToggle />);

    fireEvent.click(screen.getByRole('radio', { name: 'اردو' }));

    expect(useLanguageStore.getState().language).toBe('UR');
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('UR');
  });

  it('switches back to English (LTR) on click', () => {
    useLanguageStore.setState({ language: 'UR', dir: 'rtl' });
    render(<LanguageToggle />);

    fireEvent.click(screen.getByRole('radio', { name: 'EN' }));

    expect(useLanguageStore.getState().language).toBe('EN');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('EN');
  });

  it('exposes the active option via aria-checked and roving tabindex', () => {
    render(<LanguageToggle />);

    const en = screen.getByRole('radio', { name: 'EN' });
    const ur = screen.getByRole('radio', { name: 'اردو' });

    expect(en).toHaveAttribute('aria-checked', 'true');
    expect(en).toHaveAttribute('tabindex', '0');
    expect(ur).toHaveAttribute('aria-checked', 'false');
    expect(ur).toHaveAttribute('tabindex', '-1');
  });

  it('tags each option with its own lang attribute', () => {
    render(<LanguageToggle />);

    expect(screen.getByRole('radio', { name: 'EN' })).toHaveAttribute('lang', 'en');
    expect(screen.getByRole('radio', { name: 'اردو' })).toHaveAttribute('lang', 'ur');
  });

  it('moves to the next language with ArrowRight in LTR', () => {
    render(<LanguageToggle />);

    const en = screen.getByRole('radio', { name: 'EN' });
    en.focus();
    fireEvent.keyDown(en, { key: 'ArrowRight' });

    expect(useLanguageStore.getState().language).toBe('UR');
    expect(screen.getByRole('radio', { name: 'اردو' })).toHaveAttribute('aria-checked', 'true');
  });

  it('reverses arrow direction under RTL (ArrowRight moves to the previous option)', () => {
    useLanguageStore.setState({ language: 'UR', dir: 'rtl' });
    render(<LanguageToggle />);

    const ur = screen.getByRole('radio', { name: 'اردو' });
    ur.focus();
    fireEvent.keyDown(ur, { key: 'ArrowRight' });

    expect(useLanguageStore.getState().language).toBe('EN');
  });

  it('jumps to the last option with End', () => {
    render(<LanguageToggle />);

    const en = screen.getByRole('radio', { name: 'EN' });
    en.focus();
    fireEvent.keyDown(en, { key: 'End' });

    expect(useLanguageStore.getState().language).toBe('UR');
  });

  it('jumps to the first option with Home', () => {
    useLanguageStore.setState({ language: 'UR', dir: 'rtl' });
    render(<LanguageToggle />);

    const ur = screen.getByRole('radio', { name: 'اردو' });
    ur.focus();
    fireEvent.keyDown(ur, { key: 'Home' });

    expect(useLanguageStore.getState().language).toBe('EN');
  });

  it('announces the change in the newly selected language', () => {
    render(<LanguageToggle />);

    fireEvent.click(screen.getByRole('radio', { name: 'اردو' }));

    expect(screen.getByRole('status')).toHaveTextContent('زبان اردو میں تبدیل ہو گئی');
  });

  it('locks the control briefly after a switch to prevent double-toggling', () => {
    render(<LanguageToggle />);

    fireEvent.click(screen.getByRole('radio', { name: 'اردو' }));
    // A second immediate click must be ignored while the ~300ms lock is held.
    fireEvent.click(screen.getByRole('radio', { name: 'EN' }));

    expect(useLanguageStore.getState().language).toBe('UR');
  });
});
