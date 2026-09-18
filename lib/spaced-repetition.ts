export interface ReviewSchedule {
  nextReviewDate: string;
  reviewIntervalDays: number;
}

export function calculateReviewSchedule({
  accuracy,
  masteryLevel,
}: {
  accuracy: number;
  masteryLevel: string;
}): ReviewSchedule {
  let intervalDays: number;

  if (accuracy < 50) {
    intervalDays = 0;
  } else if (accuracy < 70) {
    intervalDays = 1;
  } else if (accuracy < 90) {
    intervalDays = 3;
  } else if (masteryLevel === "mastered") {
    intervalDays = 14;
  } else {
    intervalDays = 7;
  }

  const nextReview = new Date();

  nextReview.setDate(nextReview.getDate() + intervalDays);

  const nextReviewDate = nextReview.toISOString().split("T")[0];

  return {
    nextReviewDate,
    reviewIntervalDays: intervalDays,
  };
}
