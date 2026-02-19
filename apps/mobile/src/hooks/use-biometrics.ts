/**
 * useBiometrics Hook
 * Hook for biometric authentication
 * TODO: Implement biometrics hook
 */
export function useBiometrics() {
  // TODO: Implement using expo-local-authentication
  return {
    isAvailable: false,
    authenticate: async () => ({ success: false }),
  };
}
