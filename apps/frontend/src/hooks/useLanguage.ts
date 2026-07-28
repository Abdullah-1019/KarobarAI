import { useLanguageStore } from '../lib/languageStore';

// Thin hook wrapper so features import from `hooks/`, not the zustand store directly.
export function useLanguage() {
  const language = useLanguageStore((state) => state.language);
  const dir = useLanguageStore((state) => state.dir);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  return { language, dir, setLanguage };
}
