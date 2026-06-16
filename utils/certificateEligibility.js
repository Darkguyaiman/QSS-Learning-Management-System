const { getPassingScore } = require('./testScores');
const PRACTICAL_OUTSTANDING_SCORE = 70;

function getBestCertAttempt(testAttempts) {
  const certAttempts = (testAttempts || []).filter((attempt) => attempt.test_type === 'certificate_enrolment');
  return certAttempts.reduce((best, attempt) => {
    if (!best) return attempt;
    const bestScore = parseFloat(best.score) || 0;
    const currScore = parseFloat(attempt.score) || 0;
    return currScore > bestScore ? attempt : best;
  }, null);
}

function hasLockedTestPart(testAttempts) {
  const attemptStatsByType = (testAttempts || []).reduce((acc, attempt) => {
    const testType = attempt.test_type;
    const score = parseFloat(attempt.score) || 0;
    if (!acc[testType]) {
      acc[testType] = { failed: 0, hasPass: false };
    }
    if (score >= getPassingScore(testType)) acc[testType].hasPass = true;
    else acc[testType].failed += 1;
    return acc;
  }, {});

  return Object.values(attemptStatsByType).some((stat) => stat.failed >= 3 && !stat.hasPass);
}

function isPracticalOutstanding(handsOnScores) {
  const practicalPercentage = getPracticalPercentage(handsOnScores);
  return practicalPercentage !== null && practicalPercentage >= PRACTICAL_OUTSTANDING_SCORE;
}

function getPracticalPercentage(handsOnScores) {
  if (!handsOnScores || handsOnScores.length === 0) return null;

  const avg = handsOnScores.reduce((sum, s) => {
    const maxScore = parseFloat(s.max_score) || 0;
    const score = parseFloat(s.score) || 0;
    return sum + (maxScore > 0 ? (score / maxScore) * 100 : 0);
  }, 0) / handsOnScores.length;

  return avg;
}

function canDownloadCertificate({
  testAttempts,
  handsOnScores,
  trainingType,
  releaseOverride
}) {
  if (hasLockedTestPart(testAttempts)) return false;

  if (releaseOverride) {
    return true;
  }

  const certAttempt = getBestCertAttempt(testAttempts);
  const certScore = certAttempt ? parseFloat(certAttempt.score) : null;
  const certOutstanding = certScore !== null && certScore >= getPassingScore('certificate_enrolment');
  const practicalOutstanding = trainingType !== 'main' || isPracticalOutstanding(handsOnScores);

  return certOutstanding && practicalOutstanding;
}

function getCertificateReleaseOverrideReason({
  testAttempts,
  handsOnScores,
  trainingType,
  releaseOverride
}) {
  if (releaseOverride || hasLockedTestPart(testAttempts)) return null;

  const certAttempt = getBestCertAttempt(testAttempts);
  if (!certAttempt) return null;

  const certScore = parseFloat(certAttempt.score);
  if (Number.isFinite(certScore) && certScore < getPassingScore('certificate_enrolment')) {
    return 'certificate_enrolment';
  }

  if (trainingType === 'main' && handsOnScores && handsOnScores.length > 0 && !isPracticalOutstanding(handsOnScores)) {
    return 'practical_learning_outcome';
  }

  return null;
}

function canRequestCertificateReleaseOverride(options) {
  return getCertificateReleaseOverrideReason(options) !== null;
}

module.exports = {
  getBestCertAttempt,
  hasLockedTestPart,
  getPracticalPercentage,
  isPracticalOutstanding,
  PRACTICAL_OUTSTANDING_SCORE,
  getCertificateReleaseOverrideReason,
  canDownloadCertificate,
  canRequestCertificateReleaseOverride
};
