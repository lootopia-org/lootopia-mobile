/** Matches backend `level_from_points`: level = points / 100. */
export const POINTS_PER_LEVEL = 100;

export type LevelProgress = {
  displayLevel: number;
  pointsIntoLevel: number;
  pointsToNextLevel: number;
  nextLevelPoints: number;
  ratio: number;
};

export function getLevelProgress(points: number): LevelProgress {
  const safePoints = Math.max(0, points);
  const levelIndex = Math.floor(safePoints / POINTS_PER_LEVEL);
  const pointsIntoLevel = safePoints - levelIndex * POINTS_PER_LEVEL;
  const pointsToNextLevel = POINTS_PER_LEVEL - pointsIntoLevel;

  return {
    displayLevel: levelIndex + 1,
    pointsIntoLevel,
    pointsToNextLevel,
    nextLevelPoints: (levelIndex + 1) * POINTS_PER_LEVEL,
    ratio: pointsIntoLevel / POINTS_PER_LEVEL,
  };
}
