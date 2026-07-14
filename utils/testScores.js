const PASSING_SCORE = 80;
const CERTIFICATE_ENROLMENT_PASSING_SCORE = 70;
const MAX_FAILED_ATTEMPTS = 4;

function getPassingScore(testType) {
  return testType === 'certificate_enrolment' ? CERTIFICATE_ENROLMENT_PASSING_SCORE : PASSING_SCORE;
}

module.exports = {
  PASSING_SCORE,
  CERTIFICATE_ENROLMENT_PASSING_SCORE,
  MAX_FAILED_ATTEMPTS,
  getPassingScore
};
