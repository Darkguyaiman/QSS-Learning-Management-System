const express = require('express');

const router = express.Router();

const RATING_FIELDS = [
  'overall_rating',
  'content_relevance_rating',
  'trainer_effectiveness_rating',
  'practical_confidence_rating'
];
const VALID_PACE_VALUES = new Set(['too_slow', 'about_right', 'too_fast']);

function parsePositiveId(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeText(value, maxLength) {
  const normalized = String(value || '').replace(/\r\n/g, '\n').trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function validateFeedback(body) {
  const feedback = {};
  const errors = [];

  RATING_FIELDS.forEach(field => {
    const rating = Number(String(body?.[field] || '').trim());
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      errors.push('Please answer every rating question.');
    }
    feedback[field] = rating;
  });

  feedback.pace = String(body?.pace || '').trim();
  if (!VALID_PACE_VALUES.has(feedback.pace)) {
    errors.push('Please select the training pace.');
  }

  feedback.most_valuable = normalizeText(body?.most_valuable, 2000);
  feedback.improvement_suggestions = normalizeText(body?.improvement_suggestions, 2000);
  feedback.additional_comments = normalizeText(body?.additional_comments, 4000);

  return {
    feedback,
    error: [...new Set(errors)].join(' ')
  };
}

async function getTraineeFeedbackContext(db, trainingId, traineeId) {
  const [rows] = await db.query(`
    SELECT
      t.id AS training_id,
      t.title AS training_title,
      t.description AS training_description,
      t.status AS training_status,
      t.is_locked AS training_is_locked,
      t.start_datetime,
      t.end_datetime,
      e.id AS enrollment_id,
      tf.id AS feedback_id,
      tf.overall_rating,
      tf.content_relevance_rating,
      tf.trainer_effectiveness_rating,
      tf.practical_confidence_rating,
      tf.pace,
      tf.most_valuable,
      tf.improvement_suggestions,
      tf.additional_comments,
      tf.submitted_at
    FROM trainings t
    JOIN enrollments e
      ON e.training_id = t.id
      AND e.trainee_id = ?
    LEFT JOIN training_feedback tf ON tf.enrollment_id = e.id
    WHERE t.id = ?
    LIMIT 1
  `, [traineeId, trainingId]);

  if (!rows.length) return null;
  const row = rows[0];
  return {
    training: {
      id: row.training_id,
      title: row.training_title,
      description: row.training_description,
      status: row.training_status,
      is_locked: row.training_is_locked,
      start_datetime: row.start_datetime,
      end_datetime: row.end_datetime
    },
    enrollment: { id: row.enrollment_id },
    feedback: row.feedback_id ? {
      id: row.feedback_id,
      overall_rating: row.overall_rating,
      content_relevance_rating: row.content_relevance_rating,
      trainer_effectiveness_rating: row.trainer_effectiveness_rating,
      practical_confidence_rating: row.practical_confidence_rating,
      pace: row.pace,
      most_valuable: row.most_valuable,
      improvement_suggestions: row.improvement_suggestions,
      additional_comments: row.additional_comments,
      submitted_at: row.submitted_at
    } : null
  };
}

function renderTraineeFeedbackPage(req, res, context, options = {}) {
  return res.status(options.status || 200).render('training/feedback', {
    user: req.session,
    training: context.training,
    enrollment: context.enrollment,
    trainingFeedback: context.feedback,
    submitted: req.query.submitted === '1',
    alreadySubmitted: req.query.already === '1',
    validationError: options.validationError || null,
    feedbackDraft: options.feedbackDraft || null
  });
}

router.get('/training/:trainingId', async (req, res) => {
  if (req.session.userRole !== 'trainee') {
    return res.status(403).send('Training feedback is available to enrolled trainees only.');
  }

  const trainingId = parsePositiveId(req.params.trainingId);
  if (!trainingId) return res.status(404).send('Training not found');

  try {
    const context = await getTraineeFeedbackContext(req.db, trainingId, req.session.userId);
    if (!context) return res.status(404).send('Training enrollment not found');
    return renderTraineeFeedbackPage(req, res, context);
  } catch (error) {
    console.error('Training feedback page error:', error);
    return res.status(500).send('Error loading training feedback');
  }
});

router.post('/training/:trainingId', async (req, res) => {
  if (req.session.userRole !== 'trainee') {
    return res.status(403).send('Training feedback is available to enrolled trainees only.');
  }

  const trainingId = parsePositiveId(req.params.trainingId);
  if (!trainingId) return res.status(404).send('Training not found');

  try {
    const context = await getTraineeFeedbackContext(req.db, trainingId, req.session.userId);
    if (!context) return res.status(404).send('Training enrollment not found');
    if (context.feedback) {
      return res.redirect(`/feedback/training/${trainingId}?already=1`);
    }

    const validation = validateFeedback(req.body);
    if (validation.error) {
      return renderTraineeFeedbackPage(req, res, context, {
        status: 400,
        validationError: validation.error,
        feedbackDraft: validation.feedback
      });
    }

    const feedback = validation.feedback;
    await req.db.query(`
      INSERT INTO training_feedback (
        enrollment_id,
        overall_rating,
        content_relevance_rating,
        trainer_effectiveness_rating,
        practical_confidence_rating,
        pace,
        most_valuable,
        improvement_suggestions,
        additional_comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      context.enrollment.id,
      feedback.overall_rating,
      feedback.content_relevance_rating,
      feedback.trainer_effectiveness_rating,
      feedback.practical_confidence_rating,
      feedback.pace,
      feedback.most_valuable,
      feedback.improvement_suggestions,
      feedback.additional_comments
    ]);

    return res.redirect(`/feedback/training/${trainingId}?submitted=1`);
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      return res.redirect(`/feedback/training/${trainingId}?already=1`);
    }
    console.error('Training feedback submission error:', error);
    return res.status(500).send('Error submitting training feedback');
  }
});

router.get('/', async (req, res) => {
  if (req.session.userRole !== 'admin') {
    return res.status(403).send('Access denied');
  }

  const selectedTrainingId = parsePositiveId(req.query.training);
  const selectedRating = [1, 2, 3, 4, 5].includes(Number(req.query.rating)) ? Number(req.query.rating) : null;
  const selectedPace = VALID_PACE_VALUES.has(String(req.query.pace || '')) ? String(req.query.pace) : '';
  const searchQuery = String(req.query.search || '').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = 24;

  const clauses = [];
  const params = [];
  if (selectedTrainingId) {
    clauses.push('t.id = ?');
    params.push(selectedTrainingId);
  }
  if (selectedRating) {
    clauses.push('tf.overall_rating = ?');
    params.push(selectedRating);
  }
  if (selectedPace) {
    clauses.push('tf.pace = ?');
    params.push(selectedPace);
  }
  if (searchQuery) {
    clauses.push(`(
      t.title LIKE ? OR
      tr.trainee_id LIKE ? OR
      tr.email LIKE ? OR
      CONCAT(tr.first_name, ' ', tr.last_name) LIKE ?
    )`);
    const pattern = `%${searchQuery}%`;
    params.push(pattern, pattern, pattern, pattern);
  }
  const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  try {
    const baseJoins = `
      FROM training_feedback tf
      JOIN enrollments e ON e.id = tf.enrollment_id
      JOIN trainings t ON t.id = e.training_id
      JOIN trainees tr ON tr.id = e.trainee_id
      LEFT JOIN healthcare h ON h.id = COALESCE(e.healthcare_id_at_enrollment, tr.healthcare_id)
    `;

    const [[summaryRows], [countRows], [trainingOptions]] = await Promise.all([
      req.db.query(`
        SELECT
          COUNT(*) AS response_count,
          ROUND(AVG(tf.overall_rating), 1) AS average_overall,
          ROUND(AVG(tf.content_relevance_rating), 1) AS average_content,
          ROUND(AVG(tf.trainer_effectiveness_rating), 1) AS average_trainer,
          ROUND(AVG(tf.practical_confidence_rating), 1) AS average_confidence
        ${baseJoins}
        ${whereClause}
      `, params),
      req.db.query(`SELECT COUNT(*) AS total ${baseJoins} ${whereClause}`, params),
      req.db.query(`
        SELECT DISTINCT t.id, t.title
        FROM training_feedback tf
        JOIN enrollments e ON e.id = tf.enrollment_id
        JOIN trainings t ON t.id = e.training_id
        ORDER BY t.title ASC
      `)
    ]);

    const totalResponses = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalResponses / pageSize));
    const safePage = Math.min(page, totalPages);
    const [responses] = await req.db.query(`
      SELECT
        tf.*,
        t.id AS training_id,
        t.title AS training_title,
        tr.trainee_id AS trainee_public_id,
        tr.first_name,
        tr.last_name,
        tr.email,
        h.name AS healthcare_name
      ${baseJoins}
      ${whereClause}
      ORDER BY tf.submitted_at DESC, tf.id DESC
      LIMIT ? OFFSET ?
    `, [...params, pageSize, (safePage - 1) * pageSize]);

    return res.render('feedback/index', {
      user: req.session,
      summary: summaryRows?.[0] || {},
      responses: responses || [],
      trainingOptions: trainingOptions || [],
      filters: {
        trainingId: selectedTrainingId ? String(selectedTrainingId) : '',
        rating: selectedRating ? String(selectedRating) : '',
        pace: selectedPace,
        search: searchQuery
      },
      pagination: {
        page: safePage,
        totalPages,
        totalResponses
      }
    });
  } catch (error) {
    console.error('Admin feedback page error:', error);
    return res.status(500).send('Error loading feedback');
  }
});

module.exports = router;
