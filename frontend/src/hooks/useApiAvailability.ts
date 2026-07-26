import { useEffect, useState } from 'react';
import { API_AVAILABLE_EVENT, API_UNAVAILABLE_EVENT } from '../api/client';

/** True once any request has failed with no server response (network error, timeout, DNS failure). */
export function useApiAvailability(): boolean {
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    function handleUnavailable() {
      setIsAvailable(false);
    }
    function handleAvailable() {
      setIsAvailable(true);
    }

    window.addEventListener(API_UNAVAILABLE_EVENT, handleUnavailable);
    window.addEventListener(API_AVAILABLE_EVENT, handleAvailable);
    return () => {
      window.removeEventListener(API_UNAVAILABLE_EVENT, handleUnavailable);
      window.removeEventListener(API_AVAILABLE_EVENT, handleAvailable);
    };
  }, []);

  return isAvailable;
}
