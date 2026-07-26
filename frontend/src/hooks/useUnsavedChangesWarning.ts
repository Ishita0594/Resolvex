import { useEffect } from 'react';

/**
 * Warns the user with the browser's native confirmation dialog before they close the
 * tab or reload while a form has unsaved input. Cannot intercept in-app route changes
 * without a data router (this app uses plain BrowserRouter), so it only covers
 * tab-close/reload/refresh — the most common way to accidentally lose a draft.
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);
}
