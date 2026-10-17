import { createContext } from 'react';

/** The toolbar element BrowseLayout reserves for the result count, so count and sort share a row. */
export const BrowseCountSlot = createContext<HTMLElement | null>(null);
