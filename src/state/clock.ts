/**
 * The playback clock. Mutable on purpose: it changes every frame and must never cause a
 * React render. Only `PlaybackDriver` (scene) writes `time`; everything else reads it in
 * useFrame / requestAnimationFrame, or calls the seek helpers in the playback store.
 */
export const clock = {
  time: 0,
};
