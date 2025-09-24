/**
 * Feature flags and environment-based configurations
 */

/**
 * Check if Google authentication should be disabled
 * Returns true when NEXT_PUBLIC_STAGE is 'alpha'
 */
export const isGoogleAuthDisabled = (): boolean => {
  return process.env.NEXT_PUBLIC_STAGE === 'alpha';
};

/**
 * Check if the current stage is alpha
 */
export const isAlphaStage = (): boolean => {
  return process.env.NEXT_PUBLIC_STAGE === 'alpha';
};

/**
 * Check if the current stage is beta
 */
export const isBetaStage = (): boolean => {
  return process.env.NEXT_PUBLIC_STAGE === 'beta';
};

/**
 * Check if the current stage is production
 */
export const isProductionStage = (): boolean => {
  return process.env.NEXT_PUBLIC_STAGE === 'production';
};