const fs = require('fs');
const path = require('path');
const packageGenerator = require('./package-generator');
const { pool } = require('../config/database');

const JOB_STORAGE_ROOT = path.join(__dirname, '..', 'generated', 'package-jobs');
const JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

let bootstrapPromise = null;
let workerPromise = null;

function ensureJobStorageRoot() {
  fs.mkdirSync(JOB_STORAGE_ROOT, { recursive: true });
}

function normalizeFormData(formDataRaw) {
  return {
    hospitalName: String(formDataRaw?.hospitalName || '').trim(),
    deviceModel: String(formDataRaw?.deviceModel || '').trim(),
    address: String(formDataRaw?.address || '').trim(),
    recipientName: String(formDataRaw?.recipientName || '').trim(),
    recipientPhone: String(formDataRaw?.recipientPhone || '').trim()
  };
}

function buildPackageFilename(training) {
  const packDateSource = String(training.start_datetime || training.end_datetime || new Date().toISOString().slice(0, 10))
    .split('T')[0]
    .split(' ')[0];
  return `${packageGenerator.sanitizeFileName(training.title || 'Training')}_${packageGenerator.sanitizeFileName(packDateSource)}_Package.zip`;
}

function parseJobRow(row) {
  if (!row) return null;
  return {
    ...row,
    formData: row.form_data_json ? JSON.parse(row.form_data_json) : null
  };
}

async function bootstrapQueue(db = pool) {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      ensureJobStorageRoot();
      await db.query(`
        CREATE TABLE IF NOT EXISTS package_generation_jobs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          training_id INT NOT NULL,
          created_by INT NOT NULL,
          status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
          form_data_json LONGTEXT NOT NULL,
          generated_by_name VARCHAR(255) NOT NULL DEFAULT '',
          generated_by_position VARCHAR(255) NOT NULL DEFAULT '',
          output_path VARCHAR(1024) NULL,
          output_filename VARCHAR(255) NULL,
          error_message TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          started_at DATETIME NULL,
          completed_at DATETIME NULL,
          INDEX idx_package_generation_jobs_status (status, created_at),
          INDEX idx_package_generation_jobs_lookup (created_by, training_id, status, created_at),
          FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      await db.query(
        `UPDATE package_generation_jobs
         SET status = ?, started_at = NULL, error_message = 'Job re-queued after server restart.'
         WHERE status = ?`,
        [JOB_STATUS.QUEUED, JOB_STATUS.PROCESSING]
      );
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}

async function getTrainingForPackage(db, trainingId) {
  const [trainings] = await db.query(
    'SELECT id, type, title, status, start_datetime, end_datetime, affiliated_company FROM trainings WHERE id = ? LIMIT 1',
    [trainingId]
  );
  return trainings?.[0] || null;
}

async function enqueuePackageJob({ db = pool, trainingId, formData, userId, generatedByName, generatedByPosition }) {
  await bootstrapQueue(db);

  const training = await getTrainingForPackage(db, trainingId);
  if (!training) {
    const err = new Error('Training not found');
    err.statusCode = 404;
    throw err;
  }
  if (!Number(training.is_locked || 0)) {
    const err = new Error('Package is only available after training is locked.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedFormData = normalizeFormData(formData);
  if (!normalizedFormData.hospitalName || !normalizedFormData.deviceModel || !normalizedFormData.address || !normalizedFormData.recipientName || !normalizedFormData.recipientPhone) {
    const err = new Error('Missing required form fields');
    err.statusCode = 400;
    throw err;
  }

  const serializedFormData = JSON.stringify(normalizedFormData);
  const [existingJobs] = await db.query(
    `SELECT id, status
     FROM package_generation_jobs
     WHERE training_id = ?
       AND created_by = ?
       AND form_data_json = ?
       AND status IN (?, ?)
     ORDER BY id DESC
     LIMIT 1`,
    [trainingId, userId, serializedFormData, JOB_STATUS.QUEUED, JOB_STATUS.PROCESSING]
  );

  if (existingJobs?.length) {
    schedulePackageJobs(db);
    return {
      jobId: existingJobs[0].id,
      status: existingJobs[0].status,
      reused: true
    };
  }

  const [result] = await db.query(
    `INSERT INTO package_generation_jobs
      (training_id, created_by, status, form_data_json, generated_by_name, generated_by_position)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      trainingId,
      userId,
      JOB_STATUS.QUEUED,
      serializedFormData,
      String(generatedByName || ''),
      String(generatedByPosition || '')
    ]
  );

  schedulePackageJobs(db);

  return {
    jobId: result.insertId,
    status: JOB_STATUS.QUEUED,
    reused: false
  };
}

async function getPackageJob({ db = pool, jobId, trainingId, userId }) {
  await bootstrapQueue(db);
  const [rows] = await db.query(
    `SELECT *
     FROM package_generation_jobs
     WHERE id = ? AND training_id = ? AND created_by = ?
     LIMIT 1`,
    [jobId, trainingId, userId]
  );
  return parseJobRow(rows?.[0] || null);
}

async function claimNextQueuedJob(db) {
  const [rows] = await db.query(
    `SELECT id
     FROM package_generation_jobs
     WHERE status = ?
     ORDER BY created_at ASC, id ASC
     LIMIT 1`,
    [JOB_STATUS.QUEUED]
  );

  const nextJobId = rows?.[0]?.id;
  if (!nextJobId) return null;

  const [updateResult] = await db.query(
    `UPDATE package_generation_jobs
     SET status = ?, started_at = NOW(), error_message = NULL
     WHERE id = ? AND status = ?`,
    [JOB_STATUS.PROCESSING, nextJobId, JOB_STATUS.QUEUED]
  );

  if (!updateResult?.affectedRows) {
    return null;
  }

  const [claimedRows] = await db.query(
    'SELECT * FROM package_generation_jobs WHERE id = ? LIMIT 1',
    [nextJobId]
  );

  return parseJobRow(claimedRows?.[0] || null);
}

async function processQueuedJob(job, db) {
  const training = await getTrainingForPackage(db, job.training_id);
  if (!training) {
    const err = new Error('Training not found');
    err.statusCode = 404;
    throw err;
  }
  if (!Number(training.is_locked || 0)) {
    const err = new Error('Package is only available after training is locked.');
    err.statusCode = 400;
    throw err;
  }

  const zipBuffer = await packageGenerator.generatePackageZipBuffer({
    db,
    training,
    formData: job.formData,
    generatedByName: job.generated_by_name || '',
    generatedByPosition: job.generated_by_position || ''
  });

  const outputDir = path.join(JOB_STORAGE_ROOT, String(job.id));
  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputFilename = buildPackageFilename(training);
  const outputPath = path.join(outputDir, outputFilename);
  await fs.promises.writeFile(outputPath, zipBuffer);

  await db.query(
    `UPDATE package_generation_jobs
     SET status = ?, output_path = ?, output_filename = ?, completed_at = NOW(), error_message = NULL
     WHERE id = ?`,
    [JOB_STATUS.COMPLETED, outputPath, outputFilename, job.id]
  );
}

async function markJobFailed(db, jobId, error) {
  const rawMessage = String(error?.message || 'Failed to generate package zip');
  const errorMessage = rawMessage.length > 2000 ? rawMessage.slice(0, 2000) : rawMessage;
  await db.query(
    `UPDATE package_generation_jobs
     SET status = ?, completed_at = NOW(), error_message = ?
     WHERE id = ?`,
    [JOB_STATUS.FAILED, errorMessage, jobId]
  );
}

async function consumeCompletedJob({ db = pool, jobId, trainingId, userId }) {
  await bootstrapQueue(db);

  const job = await getPackageJob({ db, jobId, trainingId, userId });
  if (!job) return null;

  if (job.output_path) {
    try {
      await fs.promises.unlink(job.output_path);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.error(`Failed to delete package output for job ${jobId}:`, error);
      }
    }

    const outputDir = path.dirname(job.output_path);
    try {
      await fs.promises.rm(outputDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to delete package job directory for job ${jobId}:`, error);
    }
  }

  await db.query(
    'DELETE FROM package_generation_jobs WHERE id = ? AND training_id = ? AND created_by = ?',
    [jobId, trainingId, userId]
  );

  return true;
}

async function runWorker(db = pool) {
  await bootstrapQueue(db);

  while (true) {
    const job = await claimNextQueuedJob(db);
    if (!job) break;

    try {
      await processQueuedJob(job, db);
    } catch (error) {
      console.error(`Package generation job ${job.id} failed:`, error);
      await markJobFailed(db, job.id, error);
    }
  }
}

function schedulePackageJobs(db = pool) {
  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        await runWorker(db);
      } finally {
        workerPromise = null;
        try {
          const [queuedRows] = await db.query(
            'SELECT id FROM package_generation_jobs WHERE status = ? LIMIT 1',
            [JOB_STATUS.QUEUED]
          );
          if (queuedRows?.length) {
            schedulePackageJobs(db);
          }
        } catch (error) {
          console.error('Package queue reschedule check failed:', error);
        }
      }
    })().catch((error) => {
      console.error('Package queue worker crashed:', error);
      workerPromise = null;
    });
  }

  return workerPromise;
}

void schedulePackageJobs(pool);

module.exports = {
  JOB_STATUS,
  consumeCompletedJob,
  enqueuePackageJob,
  getPackageJob,
  normalizeFormData,
  schedulePackageJobs
};
