/**
 * Hook to set up the AuthRedirectManager with modal opener functionality
 * This should be used in the root layout or app component
 */

import { useEffect } from 'react';
import { useModal } from '@/stores/use-ui-store';
import { AuthRedirectManager } from '@/lib/auth-redirect';

export function useAuthRedirectSetup() {
  const { openModal } = useModal();

  useEffect(() => {
    // Set the global modal opener for AuthRedirectManager
    AuthRedirectManager.setModalOpener(openModal);

    // Cleanup function (though the modal opener should persist for the app lifetime)
    return () => {
      // No cleanup needed as we want this to persist
    };
  }, [openModal]);
}