/**
 * Mobile-specific hooks
 */

/**
 * useCamera Hook
 * Hook for camera access and QR scanning
 * TODO: Implement camera hook
 */
export function useCamera() {
  // TODO: Implement using expo-camera
  return {
    hasPermission: false,
    requestPermission: async () => {},
    startScanning: () => {},
    stopScanning: () => {},
  };
}
