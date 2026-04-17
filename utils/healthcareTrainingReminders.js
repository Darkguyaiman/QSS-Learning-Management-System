const HEALTHCARE_TRAINING_REMINDER_OPTIONS = [
  { value: '6_months', label: '6 Months', months: 6 },
  { value: '1_year', label: '1 Year', months: 12 },
  { value: '2_years', label: '2 Years', months: 24 },
  { value: '3_years', label: '3 Years', months: 36 }
];

function getHealthcareTrainingReminderOption(value) {
  return HEALTHCARE_TRAINING_REMINDER_OPTIONS.find(option => option.value === value) || null;
}

function formatDateOnly(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const rawValue = String(value).trim();
  if (!rawValue) {
    return null;
  }

  const date = new Date(`${rawValue.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setMonth(result.getMonth() + months);
  return result;
}

function calculateHealthcareTrainingReminderDate(reminderInterval, baseDate = new Date()) {
  const option = getHealthcareTrainingReminderOption(reminderInterval);
  if (!option) {
    return null;
  }

  const startDate = parseDateOnly(baseDate) || parseDateOnly(new Date());
  return formatDateOnly(addMonths(startDate, option.months));
}

function resolveNextHealthcareTrainingReminderDate(reminderInterval, existingDueDate, referenceDate = new Date()) {
  const option = getHealthcareTrainingReminderOption(reminderInterval);
  if (!option) {
    return null;
  }

  const today = parseDateOnly(referenceDate) || parseDateOnly(new Date());
  let dueDate = parseDateOnly(existingDueDate);

  if (!dueDate) {
    return calculateHealthcareTrainingReminderDate(reminderInterval, today);
  }

  while (dueDate < today) {
    dueDate = addMonths(dueDate, option.months);
  }

  return formatDateOnly(dueDate);
}

async function refreshHealthcareTrainingReminderCycles(db, referenceDate = new Date()) {
  const today = formatDateOnly(parseDateOnly(referenceDate) || new Date());
  const [rows] = await db.query(
    `SELECT id, training_reminder_interval, training_reminder_due_date
     FROM healthcare
     WHERE training_reminder_interval IS NOT NULL
       AND training_reminder_due_date IS NOT NULL
       AND training_reminder_due_date < ?`,
    [today]
  );

  for (const row of rows) {
    const nextDueDate = resolveNextHealthcareTrainingReminderDate(
      row.training_reminder_interval,
      row.training_reminder_due_date,
      referenceDate
    );

    if (nextDueDate && nextDueDate !== formatDateOnly(parseDateOnly(row.training_reminder_due_date))) {
      await db.query(
        'UPDATE healthcare SET training_reminder_due_date = ? WHERE id = ?',
        [nextDueDate, row.id]
      );
    }
  }
}

module.exports = {
  HEALTHCARE_TRAINING_REMINDER_OPTIONS,
  getHealthcareTrainingReminderOption,
  calculateHealthcareTrainingReminderDate,
  resolveNextHealthcareTrainingReminderDate,
  refreshHealthcareTrainingReminderCycles
};
