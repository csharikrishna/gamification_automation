// Core Candidate Moments & Evaluation Schema
// Governs extracted candidate moment windows, quality thresholds, and deduplication logic.

const CANDIDATE_FORMATS = Object.freeze({
  FULL_MATCH: 'FULL_MATCH',
  CLIMAX_THRILLER: 'CLIMAX_THRILLER',
  OPENING_BLITZ: 'OPENING_BLITZ'
});

const QUALITY_THRESHOLDS = Object.freeze({
  MINIMUM_APPROVAL_SCORE: 75,
  MAXIMUM_QUALITY_SCORE: 100,
  TARGET_PACING_WEIGHT: 25,
  TARGET_DRAMA_WEIGHT: 25,
  TARGET_GROWTH_WEIGHT: 25,
  TARGET_TECHNICAL_WEIGHT: 25
});

class CandidateValidator {
  static validate(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('Candidate validation failed: Must be a non-null object.');
    }

    if (!candidate.clipId || typeof candidate.clipId !== 'string') {
      throw new Error('Candidate validation failed: "clipId" must be a non-empty string.');
    }

    if (!Object.values(CANDIDATE_FORMATS).includes(candidate.format)) {
      throw new Error(`Candidate validation failed: Invalid format "${candidate.format}".`);
    }

    if (typeof candidate.startTime !== 'number' || candidate.startTime < 0) {
      throw new Error(`Candidate validation failed: "startTime" must be >= 0 (got ${candidate.startTime}).`);
    }

    if (typeof candidate.endTime !== 'number' || candidate.endTime <= candidate.startTime) {
      throw new Error(`Candidate validation failed: "endTime" must be greater than startTime (got ${candidate.endTime}).`);
    }

    return true;
  }
}

module.exports = {
  CANDIDATE_FORMATS,
  QUALITY_THRESHOLDS,
  CandidateValidator
};
