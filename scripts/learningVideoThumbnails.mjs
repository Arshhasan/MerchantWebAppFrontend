/**
 * Canonical thumbnail URLs for `learning_videos` (Firebase Storage — LearningVideos).
 * Used by seed and update scripts.
 */
export const LEARNING_VIDEO_THUMBNAILS = [
  'https://firebasestorage.googleapis.com/v0/b/bestbybites-76bcd.firebasestorage.app/o/LearningVideos%2FTHUMBNAIL-1.png?alt=media&token=83de120f-d923-40cb-8380-200eec062bbe',
  'https://firebasestorage.googleapis.com/v0/b/bestbybites-76bcd.firebasestorage.app/o/LearningVideos%2FTHUMBNAIL-2.png?alt=media&token=e24da3a8-d9bf-46c9-a5c3-f7f58c97a203',
  'https://firebasestorage.googleapis.com/v0/b/bestbybites-76bcd.firebasestorage.app/o/LearningVideos%2FTHUMBNAIL-3.png?alt=media&token=f3a95710-176f-474f-873b-1c3634960714',
];

export function thumbnailForIndex(index) {
  return LEARNING_VIDEO_THUMBNAILS[index % LEARNING_VIDEO_THUMBNAILS.length];
}
