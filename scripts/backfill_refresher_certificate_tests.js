require('dotenv').config();
const { pool } = require('../config/database');

async function selectQuestionsForTest(db, testType, totalQuestions, moduleId) {
  const [objectives] = await db.query('SELECT id FROM objectives ORDER BY id');
  if (objectives.length === 0) {
    throw new Error('No objectives found in the system');
  }

  const selectedQuestionIds = [];
  const questionsByObjective = {};
  const usedQuestionIds = new Set();

  const minPerObjective = 2;
  const requiredQuestions = objectives.length * minPerObjective;
  if (totalQuestions < requiredQuestions) {
    throw new Error(`Not enough questions requested. Need at least ${requiredQuestions} questions (2 per objective for ${objectives.length} objectives)`);
  }

  for (const objective of objectives) {
    const [questions] = await db.query(
      'SELECT id FROM questions WHERE test_type = ? AND objective_id = ? AND module_id = ? ORDER BY RAND()',
      [testType, objective.id, moduleId]
    );

    if (questions.length < minPerObjective) {
      throw new Error(`Not enough questions of type "${testType}" for objective ID ${objective.id}. Need at least ${minPerObjective}, found ${questions.length}`);
    }

    questionsByObjective[objective.id] = questions.map(q => q.id);
  }

  for (const objective of objectives) {
    const availableQuestions = questionsByObjective[objective.id].filter(id => !usedQuestionIds.has(id));
    const toSelect = Math.min(minPerObjective, availableQuestions.length);
    const selected = availableQuestions.slice(0, toSelect);
    for (const id of selected) {
      selectedQuestionIds.push(id);
      usedQuestionIds.add(id);
    }
  }

  const remainingSlots = totalQuestions - selectedQuestionIds.length;
  if (remainingSlots > 0) {
    const [allQuestions] = await db.query(
      'SELECT id FROM questions WHERE test_type = ? AND module_id = ? ORDER BY RAND()',
      [testType, moduleId]
    );

    const availableQuestions = allQuestions
      .map(q => q.id)
      .filter(id => !usedQuestionIds.has(id));

    if (availableQuestions.length < remainingSlots) {
      throw new Error(`Not enough questions available. Need ${remainingSlots} more, but only ${availableQuestions.length} available`);
    }

    const shuffled = availableQuestions.sort(() => Math.random() - 0.5);
    const additionalQuestions = shuffled.slice(0, remainingSlots);
    selectedQuestionIds.push(...additionalQuestions);
  }

  return selectedQuestionIds.sort(() => Math.random() - 0.5);
}

async function createCertificateEnrolmentTest(conn, trainingId, moduleId) {
  const [existing] = await conn.query(
    'SELECT id FROM training_tests WHERE training_id = ? AND test_type = ? LIMIT 1',
    [trainingId, 'certificate_enrolment']
  );
  if (existing.length > 0) {
    return { skipped: true, reason: 'already_exists' };
  }

  const questionIds = await selectQuestionsForTest(conn, 'certificate_enrolment', 40, moduleId);
  const [testResult] = await conn.query(
    'INSERT INTO training_tests (training_id, test_type, total_questions) VALUES (?, ?, ?)',
    [trainingId, 'certificate_enrolment', 40]
  );
  const trainingTestId = testResult.insertId;

  for (let i = 0; i < questionIds.length; i++) {
    await conn.query(
      'INSERT INTO training_test_questions (training_test_id, question_id, question_order) VALUES (?, ?, ?)',
      [trainingTestId, questionIds[i], i + 1]
    );
  }

  return { skipped: false, trainingTestId };
}

async function main() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(`
      SELECT t.id, t.module_id
      FROM trainings t
      LEFT JOIN training_tests tt
        ON tt.training_id = t.id AND tt.test_type = 'certificate_enrolment'
      WHERE t.type = 'refresher_training'
        AND t.status = 'in_progress'
        AND tt.id IS NULL
      ORDER BY t.id
    `);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      if (!row.module_id) {
        failed++;
        console.error(`Training ${row.id}: missing module_id`);
        continue;
      }

      try {
        await connection.beginTransaction();
        const outcome = await createCertificateEnrolmentTest(connection, row.id, row.module_id);
        await connection.commit();

        if (outcome.skipped) {
          skipped++;
          console.log(`Training ${row.id}: skipped (${outcome.reason})`);
        } else {
          created++;
          console.log(`Training ${row.id}: created certificate_enrolment test (id ${outcome.trainingTestId})`);
        }
      } catch (err) {
        await connection.rollback();
        failed++;
        console.error(`Training ${row.id}: failed - ${err.message || err}`);
      }
    }

    console.log(`Done. Scanned ${rows.length}. Created ${created}. Skipped ${skipped}. Failed ${failed}.`);
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Backfill failed:', err.message || err);
  process.exit(1);
});
