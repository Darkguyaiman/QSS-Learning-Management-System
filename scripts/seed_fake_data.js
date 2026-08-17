#!/usr/bin/env node
/**
 * Seed a large, realistic Malaysian K-Laser LMS dataset.
 *
 *   npm run seed:fake
 *   npm run seed:fake -- --preset=medium
 *   npm run seed:fake -- --preset=large --reset --yes
 *
 * Default password for every seeded admin/trainer/trainee is SEED_PASSWORD
 * from .env (fallback: 1234567890).
 *
 * --reset wipes trainings, trainees, tests, certificates and extra users,
 * then rebuilds demo data. Existing hospitals/settings are reused unless
 * you also pass --wipe-settings.
 */

require('dotenv').config();

const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

const SEED_PASSWORD = process.env.SEED_PASSWORD || '1234567890';
const EMAIL_DOMAIN = 'qss-lms.seed';

const PRESETS = {
  small: { trainers: 4, hospitals: 12, trainees: 80, trainings: 12, serials: 24 },
  medium: { trainers: 8, hospitals: 28, trainees: 260, trainings: 42, serials: 55 },
  large: { trainers: 14, hospitals: 48, trainees: 620, trainings: 96, serials: 96 },
  xlarge: { trainers: 18, hospitals: 48, trainees: 1200, trainings: 180, serials: 140 }
};

const OPERATIONAL_TABLES = [
  'trainer_mark_release_notifications',
  'certificate_release_overrides',
  'certificate_issues',
  'final_grades',
  'practical_learning_outcome_scores',
  'objective_scores',
  'test_answers',
  'test_attempts',
  'training_material_access',
  'attendance',
  'enrollments',
  'training_test_questions',
  'training_tests',
  'training_materials',
  'training_sections',
  'training_media',
  'training_healthcare',
  'training_devices',
  'training_trainees',
  'training_trainers',
  'practical_learning_outcomes',
  'questions',
  'package_generation_jobs',
  'trainings',
  'trainee_area_of_specializations',
  'trainees',
  'device_serial_numbers'
];

const SETTINGS_TABLES = [
  'training_titles',
  'practical_learning_outcomes_settings',
  'areas_of_specialization',
  'designations',
  'objectives',
  'modules',
  'device_models',
  'healthcare'
];

const OBJECTIVES = [
  { name: 'Mechanism of Photobiomodulation', description: 'Cellular and tissue effects of photobiomodulation therapy.' },
  { name: 'Laser Parameters', description: 'Wavelength, dose, power, frequency and treatment time.' },
  { name: 'Laser Safety', description: 'Class 4 laser hazards, PPE, contraindications and room control.' },
  { name: 'Product Knowledge', description: 'K-Laser device operation, accessories and maintenance.' },
  { name: 'Treatment Techniques', description: 'Contact, scanning, protocol selection and clinical application.' }
];

const DESIGNATIONS = [
  { name: 'Doctor', description: 'Medical officer or specialist physician.' },
  { name: 'Physiotherapist', description: 'Licensed physiotherapist providing rehabilitation care.' },
  { name: 'Nurse', description: 'Registered nurse involved in patient treatment.' },
  { name: 'Medical Assistant', description: 'Medical assistant supporting clinic procedures.' },
  { name: 'Occupational Therapist', description: 'Occupational therapist in rehab or wound care.' },
  { name: 'Podiatrist', description: 'Podiatry practitioner treating foot and wound cases.' },
  { name: 'Chiropractor', description: 'Chiropractic practitioner using adjunct laser therapy.' },
  { name: 'Clinic Manager', description: 'Manages the centre and oversees device utilisation.' }
];

const AREAS = [
  { name: 'Pain management', description: 'Musculoskeletal and neuropathic pain.' },
  { name: 'Diabetic foot ulcer', description: 'Wound care for diabetic foot complications.' },
  { name: 'Sports injury', description: 'Acute and chronic sports-related soft tissue injuries.' },
  { name: 'Physiotherapy & rehabilitation', description: 'Post-operative and musculoskeletal rehab.' },
  { name: 'Wound care', description: 'Chronic and post-surgical wound healing.' },
  { name: 'Dermatology', description: 'Selected inflammatory and healing skin conditions.' },
  { name: 'Orthopaedics', description: 'Joint, tendon and post-fracture recovery.' },
  { name: 'Neurology', description: 'Neuropathy and selected nerve-related presentations.' },
  { name: 'Chronic kidney disease', description: 'Supportive therapy in CKD-related complications.' },
  { name: 'Erectile dysfunction', description: 'Selected men\'s health laser protocols.' }
];

const MODULES = [
  { name: 'K-Laser Safety Awareness', description: 'Core safety, physics and operating principles for Class 4 laser therapy.' },
  { name: 'Photobiomodulation Fundamentals', description: 'Mechanism of action, chromophores, dose and expected biological response.' },
  { name: 'Clinical Protocols - Pain', description: 'Musculoskeletal pain, neuropathy and sports injury protocols.' },
  { name: 'Clinical Protocols - Wound Care', description: 'Wound bed preparation, dosing and monitoring of healing response.' },
  { name: 'Device Operation - Cube Series', description: 'Hands-on operation of Cube 3, Cube 4 and Cube Plus systems.' }
];

const DEVICE_MODELS = [
  { model_name: 'K-Laser Cube 4', description: 'Four-wavelength Class 4 therapy laser for clinic and hospital use.' },
  { model_name: 'K-Laser Cube 3', description: 'Three-wavelength therapy laser commonly used in outpatient rehab.' },
  { model_name: 'K-Laser Cube Plus', description: 'Higher-power Cube platform for deeper musculoskeletal protocols.' },
  { model_name: 'K-Laser Blue 4', description: 'Blue-wavelength capable system used in selected wound and dermatology cases.' },
  { model_name: 'K-Laser Cube 4 Plus', description: 'Cube 4 Plus configuration used in high-throughput specialist centres.' }
];

const TRAINING_TITLES = [
  {
    name: 'K-Laser Safety Awareness Training',
    description: 'Introduces K-Laser technology, photobiomodulation, laser classification, PPE and safe operating procedures.'
  },
  {
    name: 'K-Laser Clinical Application Training',
    description: 'Covers protocol selection, scanning and contact techniques, and treatment planning for common clinic cases.'
  },
  {
    name: 'K-Laser Advanced Protocol Workshop',
    description: 'Advanced dosing, combination protocols, difficult cases and outcome monitoring for certified operators.'
  },
  {
    name: 'K-Laser Wound Care Certification',
    description: 'Wound assessment, hygiene, dosing around compromised tissue and documentation of healing progress.'
  },
  {
    name: 'K-Laser Sports & MSK Workshop',
    description: 'Sports injury and musculoskeletal protocols, active ROM during treatment, and return-to-play considerations.'
  },
  {
    name: 'K-Laser Refresher & Recertification',
    description: 'Two-year recertification covering safety updates, device handling and reassessment of clinical competence.'
  }
];

const PLO_ASPECTS = [
  { aspect_name: 'Able to understand and explain mechanism of laser', max_score: 10 },
  { aspect_name: 'Able to understand and describe the risk of laser hazard', max_score: 10 },
  { aspect_name: 'Comply to applicable regulations and administrative control to minimize laser hazards', max_score: 10 },
  { aspect_name: 'Demonstrate appropriate safety precautions before and during performing laser therapy', max_score: 10 },
  { aspect_name: 'Exhibit professional, legal and ethical practice of laser therapy', max_score: 10 },
  { aspect_name: 'Demonstrate the ability to prevent risk and danger', max_score: 10 },
  { aspect_name: 'Able to choose accurate protocol of laser treatment', max_score: 10 },
  { aspect_name: 'Able to maintain safety handling care of equipment', max_score: 10 },
  { aspect_name: 'Able to apply laser correctly using the right treatment technique', max_score: 10 },
  { aspect_name: 'Able to supervise and analyse patient\'s response and treatment outcome', max_score: 10 }
];

const HOSPITALS = [
  ['KPJ Ampang Puteri Specialist Hospital', '1, Jalan Mamanda 9, Taman Dato Ahmad Razali, 68000 Ampang, Selangor'],
  ['KPJ Damansara Specialist Hospital', '119, Jalan SS 20/10, Damansara Utama, 47400 Petaling Jaya, Selangor'],
  ['KPJ Tawakkal KL Specialist Hospital', '1, Jalan Pahang Barat, 53000 Kuala Lumpur'],
  ['KPJ Selangor Specialist Hospital', 'Lot 1, Jalan Singa 20/1, Section 20, 40300 Shah Alam, Selangor'],
  ['KPJ Johor Specialist Hospital', '39-B, Jalan Abdul Samad, 80100 Johor Bahru, Johor'],
  ['KPJ Penang Specialist Hospital', '570, Jalan Perda Utama, Bandar Perda, 14000 Bukit Mertajam, Pulau Pinang'],
  ['KPJ Ipoh Specialist Hospital', '26, Jalan Raja Dihilir, 30350 Ipoh, Perak'],
  ['KPJ Sabah Specialist Hospital', 'Lorong Bersatu, Off Jalan Damai, 88300 Kota Kinabalu, Sabah'],
  ['Pantai Hospital Kuala Lumpur', '8, Jalan Bukit Pantai, 59100 Kuala Lumpur'],
  ['Pantai Hospital Ayer Keroh', 'No. 6, Persiaran Ayer Keroh Heights, 75450 Melaka'],
  ['Pantai Hospital Penang', '80, Jalan Masjid Negeri, 11600 George Town, Pulau Pinang'],
  ['Pantai Hospital Laguna Merbok', 'Persiaran Cendana, Bandar Laguna Merbok, 08000 Sungai Petani, Kedah'],
  ['Gleneagles Hospital Kuala Lumpur', '282, 286 & 288, Jalan Ampang, 50450 Kuala Lumpur'],
  ['Gleneagles Hospital Penang', '1, Jalan Pangkor, 10050 George Town, Pulau Pinang'],
  ['Gleneagles Hospital Johor', '2, Jalan Medini Utara 4, Medini Iskandar, 79250 Iskandar Puteri, Johor'],
  ['Prince Court Medical Centre', '39, Jalan Kia Peng, 50450 Kuala Lumpur'],
  ['Sunway Medical Centre', '5, Jalan Lagoon Selatan, Bandar Sunway, 47500 Petaling Jaya, Selangor'],
  ['Sunway Medical Centre Velocity', 'Lingkaran SV, Sunway Velocity, 55100 Kuala Lumpur'],
  ['Subang Jaya Medical Centre', '1, Jalan SS 12/1A, 47500 Subang Jaya, Selangor'],
  ['Ara Damansara Medical Centre', 'Lot 2, Jalan Lapangan Terbang Subang, Seksyen U2, 40150 Shah Alam, Selangor'],
  ['ParkCity Medical Centre', '2, Jalan Intisari Perdana, Desa ParkCity, 52200 Kuala Lumpur'],
  ['Thomson Hospital Kota Damansara', '11, Jalan Teknologi, Taman Sains Selangor, 47810 Petaling Jaya, Selangor'],
  ['Island Hospital Penang', '308, Macalister Road, 10450 George Town, Pulau Pinang'],
  ['Loh Guan Lye Specialists Centre', '238, Jalan Macalister, 10400 George Town, Pulau Pinang'],
  ['Lam Wah Ee Hospital', '141, Jalan Tan Sri Teh Ewe Lim, 11600 George Town, Pulau Pinang'],
  ['Mahkota Medical Centre', 'No. 3, Mahkota Melaka, Jalan Merdeka, 75000 Melaka'],
  ['Oriental Melaka Straits Medical Centre', 'Pusat Perubatan Klebang, 75200 Melaka'],
  ['Regency Specialist Hospital', 'No. 1, Jalan Suria, Bandar Seri Alam, 81750 Masai, Johor'],
  ['KPJ Puteri Specialist Hospital', '33, Jalan Tun Abdul Razak (Susur 5), 80000 Johor Bahru, Johor'],
  ['Columbia Asia Hospital - Bukit Rimau', 'Persiaran Selangor, Seksyen 16, 40200 Shah Alam, Selangor'],
  ['Columbia Asia Hospital - Cheras', 'Lot 33186, Jalan Suakasih, 43200 Cheras, Selangor'],
  ['Columbia Asia Hospital - Petaling Jaya', 'Lot 69, Jalan 13/6, 46200 Petaling Jaya, Selangor'],
  ['Columbia Asia Hospital - Iskandar Puteri', 'Persiaran Medini 5, Bandar Medini Iskandar, 79250 Iskandar Puteri, Johor'],
  ['Hospital Kuala Lumpur', 'Jalan Pahang, 50586 Kuala Lumpur'],
  ['Hospital Tengku Ampuan Rahimah', 'Jalan Langat, 41200 Klang, Selangor'],
  ['Hospital Sungai Buloh', 'Jalan Hospital, 47000 Sungai Buloh, Selangor'],
  ['Hospital Sultanah Aminah', 'Jalan Persiaran Abu Bakar Sultan, 80100 Johor Bahru, Johor'],
  ['Hospital Pulau Pinang', 'Jalan Residensi, 10990 George Town, Pulau Pinang'],
  ['Hospital Raja Permaisuri Bainun', 'Jalan Hospital, 30450 Ipoh, Perak'],
  ['Hospital Queen Elizabeth', 'Karung Berkunci No. 2029, 88586 Kota Kinabalu, Sabah'],
  ['Hospital Umum Sarawak', 'Jalan Hospital, 93586 Kuching, Sarawak'],
  ['Normah Medical Specialist Centre', 'Lot 937, Section 22 Kuching Town Land District, Jalan Tun Abdul Rahman Yaakub, 93050 Kuching, Sarawak'],
  ['Timberland Medical Centre', 'Lot 5164-5165, Sublot 6, 2 1/2 Mile Rock Road, 93200 Kuching, Sarawak'],
  ['KPJ Kuching Specialist Hospital', 'Lot 10448, Block 11, Jalan Tun Abdul Rahman Yaakub, 93350 Kuching, Sarawak'],
  ['Al-Islam Specialist Hospital', 'Lot 550, Jalan Kampung Pandan, 55100 Kuala Lumpur'],
  ['Tung Shin Hospital', '102, Jalan Pudu, 55100 Kuala Lumpur'],
  ['Beacon Hospital', '1, Jalan 215, Section 51, Off Jalan Templer, 46050 Petaling Jaya, Selangor'],
  ['Assunta Hospital', 'Jalan Templer, 46990 Petaling Jaya, Selangor']
];

const TRAINER_PROFILES = [
  ['Alicia', 'Tan', 'Senior Clinical Trainer', 'Photobiomodulation & MSK'],
  ['Hafiz', 'Rahman', 'Clinical Trainer', 'Laser safety'],
  ['Priya', 'Menon', 'Product Specialist', 'Wound care protocols'],
  ['Daniel', 'Wong', 'Regional Trainer', 'Cube series operation'],
  ['Siti', 'Nur Aina', 'Clinical Trainer', 'Pain management'],
  ['Jonathan', 'Lee', 'Senior Product Specialist', 'Sports injury'],
  ['Farah', 'Aziz', 'Training Coordinator', 'Clinical education'],
  ['Rajesh', 'Nair', 'Clinical Trainer', 'Diabetic foot ulcer'],
  ['Michelle', 'Chong', 'Product Specialist', 'Device applications'],
  ['Amirul', 'Hakim', 'Clinical Trainer', 'Safety & compliance'],
  ['Emily', 'Goh', 'Senior Clinical Trainer', 'Advanced protocols'],
  ['Kavitha', 'Rajan', 'Clinical Trainer', 'Rehabilitation'],
  ['Bryan', 'Lim', 'Product Specialist', 'K-Laser Cube 4'],
  ['Nurul', 'Huda', 'Administrator', 'LMS operations'],
  ['Steven', 'Ooi', 'Regional Trainer', 'East Malaysia'],
  ['Aisyah', 'Zulkifli', 'Clinical Trainer', 'Women\'s health adjunct protocols'],
  ['Marcus', 'Teo', 'Product Specialist', 'Blue 4 applications'],
  ['Lina', 'Abdullah', 'Training Coordinator', 'Hospital onboarding']
];

const MALAY_FIRST_M = ['Ahmad', 'Muhammad', 'Mohd', 'Hakim', 'Hafiz', 'Irwan', 'Faizal', 'Azlan', 'Syafiq', 'Danial', 'Irfan', 'Amir', 'Razak', 'Firdaus', 'Khairul', 'Nazmi', 'Shahrul', 'Aiman', 'Zulkarnain', 'Haziq'];
const MALAY_FIRST_F = ['Nur', 'Siti', 'Aisyah', 'Farah', 'Nadia', 'Hana', 'Aina', 'Syafiqah', 'Amira', 'Liyana', 'Izzati', 'Nabilah', 'Khairunnisa', 'Zulaikha', 'Fatin', 'Diyana', 'Balqis', 'Husna', 'Mardhiah', 'Sofea'];
const MALAY_LAST = ['Abdullah', 'Ahmad', 'Ismail', 'Hassan', 'Ibrahim', 'Rahman', 'Osman', 'Zainal', 'Yusof', 'Mahmud', 'Salleh', 'Hashim', 'Aziz', 'Kamal', 'Othman', 'Jamaludin', 'Mustafa', 'Zakaria'];
const CHINESE_SURNAMES = ['Tan', 'Lim', 'Lee', 'Wong', 'Ng', 'Chan', 'Ong', 'Goh', 'Chong', 'Teo', 'Lau', 'Yap', 'Koh', 'Chua', 'Ho', 'Low', 'Chin', 'Foo'];
const CHINESE_GIVEN_M = ['Wei Ming', 'Jun Hao', 'Jia Wei', 'Wei Jie', 'Hao Yang', 'Zhi Hao', 'Kai Xiang', 'Jun Jie', 'Bo Cheng', 'Yu Xuan', 'Wen Han', 'Jia Jun'];
const CHINESE_GIVEN_F = ['Mei Ling', 'Xin Yi', 'Jia Hui', 'Li Ting', 'Hui Min', 'Ying Xue', 'Shu Qi', 'Yun Xin', 'Jia Wen', 'Pei Shan', 'Yi Ling', 'Kai Lin'];
const INDIAN_FIRST_M = ['Rajesh', 'Kumar', 'Suresh', 'Anand', 'Vijay', 'Arjun', 'Prakash', 'Ganesh', 'Ramesh', 'Senthil', 'Mohan', 'Deepak'];
const INDIAN_FIRST_F = ['Priya', 'Kavitha', 'Lakshmi', 'Deepa', 'Anjali', 'Meena', 'Shalini', 'Nisha', 'Aishwarya', 'Tharani', 'Divya', 'Revathi'];
const INDIAN_LAST = ['Nair', 'Menon', 'Pillai', 'Krishnan', 'Subramaniam', 'Rajendran', 'Sundaram', 'Balakrishnan', 'Gopal', 'Narayanan'];

const STATE_CODES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16'];
const MOBILE_PREFIXES = ['10', '11', '12', '13', '14', '16', '17', '18', '19'];
const HEADER_IMAGES = [
  '/images/Training Headers/Header 1.jpg',
  '/images/Training Headers/Header 2.jpg',
  '/images/Training Headers/Header 3.png',
  '/images/Training Headers/Header 4.png',
  '/images/Training Headers/Header 5.png',
  '/images/Headers/QSS Header.jpg',
  '/images/Headers/PMS Header.jpg'
];

const SECTION_TEMPLATES = [
  {
    title: 'Pre-course reading',
    materials: [
      { title: 'K-Laser therapy overview', type: 'link', url: 'https://www.k-laser.com/photobiomodulation' },
      { title: 'Class 4 laser safety briefing notes', type: 'document', file_path: '/uploads/materials/k-laser-safety-notes.pdf' }
    ]
  },
  {
    title: 'Lecture & demonstration',
    materials: [
      { title: 'Device setup walkthrough', type: 'link', url: 'https://www.youtube.com/watch?v=k-laser-setup' },
      { title: 'Protocol selection slides', type: 'document', file_path: '/uploads/materials/protocol-selection.pdf' }
    ]
  },
  {
    title: 'Practical station',
    materials: [
      { title: 'Handpiece handling checklist', type: 'document', file_path: '/uploads/materials/handpiece-checklist.pdf' },
      { title: 'Scanning vs contact technique', type: 'link', url: 'https://www.k-laser.com/techniques' }
    ]
  },
  {
    title: 'Assessment',
    materials: [
      { title: 'Certificate enrolment exam guide', type: 'document', file_path: '/uploads/materials/exam-guide.pdf' }
    ]
  }
];

const PLO_COMMENTS = {
  high: [
    'Confident with safety checks, fibre handling and protocol selection.',
    'Clear explanation of photobiomodulation and appropriate scanning speed.',
    'Excellent patient communication and PPE discipline throughout the station.'
  ],
  borderline: [
    'Met the competency standard; scanning speed still a little inconsistent on darker skin types.',
    'Safety steps were complete after prompting. Protocol choice was acceptable.',
    'Competent overall; needs more practice holding the handpiece perpendicular to the skin.'
  ],
  fail: [
    'Missed two safety checks and required coaching on fibre handling.',
    'Uncertain on contraindications and default zoom. Reassessment recommended.',
    'Technique was hesitant; did not adapt scanning speed to patient feedback.'
  ]
};

const OVERRIDE_REASONS = [
  'Trainee demonstrated strong practical competency during the hands-on station. Written score was affected by language barrier. Approved by the clinical trainer after oral verification of safety items.',
  'Candidate is the centre\'s sole operator and passed a supervised practical reassessment the same afternoon. Written paper was 4 marks below the cut-off.',
  'Post-course clinic observation confirmed correct PPE, fibre care and protocol use. Release approved with a 3-month supervised practice condition.'
];

const ATTENDANCE_NOTES = [
  null,
  null,
  null,
  null,
  'Arrived after morning clinic handover.',
  'On call; joined after the safety briefing.',
  'Left 20 minutes early for an emergency case, completed the practical after lunch.',
  'Required Malay/English mixed instruction.'
];

// Compact question bank: [objectiveIndex, question, A, B, C, D, correct]
const QUESTION_BANK = [
  [0, 'What is the purpose of using K-Laser in pain management?', 'A non-invasive laser using both LLLT and HILT to accelerate tissue healing and body function', 'A surgical procedure to remove damaged tissues and relieve pain', 'A pharmaceutical intervention to manage pain symptoms', 'A physical therapy technique to improve joint mobility and flexibility', 'A'],
  [0, 'What are the biological effects of photobiomodulation?', 'It stimulates the release of endorphins only', 'It increases nitric oxide production, reduces inflammation, promotes tissue healing and provides a semi-analgesic effect', 'It blocks pain signals from reaching the brain permanently', 'It numbs the affected area like a local anaesthetic', 'B'],
  [0, 'Which four chromophores absorb photons during K-Laser treatment?', 'Melanin, water, cytochrome c oxidase and haemoglobin', 'Melanin and haemoglobin only', 'Cytochrome c oxidase and melanin only', 'Collagen and keratin only', 'A'],
  [0, 'How does K-Laser therapy support tissue repair in injured areas?', 'By increasing cellular metabolism and ATP production', 'By freezing damaged tissue to stop inflammation', 'By blocking nerve conduction permanently', 'By replacing damaged cells with artificial tissue', 'A'],
  [0, 'What role does ATP production play in photobiomodulation therapy?', 'It slows down cell activity to reduce pain', 'It enhances cellular energy which supports tissue repair', 'It destroys damaged cells to prevent inflammation', 'It blocks blood circulation to the injured area', 'B'],
  [0, 'What effect does photobiomodulation have on inflammation?', 'It increases swelling to speed recovery', 'It reduces inflammatory mediators in the tissue', 'It completely eliminates blood flow', 'It blocks all immune system responses', 'B'],
  [0, 'How does K-Laser therapy help reduce pain in musculoskeletal conditions?', 'By stimulating blood circulation and reducing inflammation', 'By permanently blocking nerve signals', 'By removing damaged tissue surgically', 'By replacing muscles with synthetic fibres', 'A'],
  [0, 'What is the primary goal of laser therapy for wounds?', 'To accelerate the healing process', 'To increase pain so the patient rests', 'To numb the area only', 'To close the wound immediately with heat', 'A'],
  [0, 'What unit is used to measure laser wavelengths?', 'Micrometers (µm)', 'Nanometers (nm)', 'Millimeters (mm)', 'Centimeters (cm)', 'B'],
  [0, 'Which statement best describes photobiomodulation?', 'Light energy is absorbed by cells and converted into a biological response', 'The laser cuts tissue to remove inflammation', 'The device injects medication into the joint', 'Heat alone is responsible for all clinical effects', 'A'],
  [1, 'What factors influence the depth of laser absorption in tissue?', 'Room temperature only', 'Colour of the practitioner\'s shirt', 'Number of previous treatments only', 'Wavelength, skin pigment and duration of beam exposure', 'D'],
  [1, 'What zoom number should be used by default if unsure?', '1', '3', '5', '4', 'C'],
  [1, 'When treating from a distance, what is the purpose of using zoom?', 'To increase the joules delivered', 'To change the size of the beam', 'To stabilize the device trolley', 'To switch the laser into surgical mode', 'B'],
  [1, 'What happens when the full dose is delivered?', 'The device emits a continuous alarm', 'The laser stops automatically', 'The room lights turn off', 'The handpiece overheats and must be replaced', 'B'],
  [1, 'Which of the following best describes High Intensity Laser Therapy (HILT)?', 'A low-energy light used only for diagnostics', 'A high-power laser used to stimulate deep tissue healing', 'A surgical laser used to remove organs', 'A cosmetic laser used only for skin resurfacing', 'B'],
  [1, 'After a corticosteroid injection, how long should you wait before using laser therapy over the joint?', '1 day', '3 days', '7 days', '10 days', 'B'],
  [1, 'Why should laser therapy be used with caution over joints with recent corticosteroid injections?', 'Risk of infection only', 'Risk of crystallization causing temporary pain', 'It increases blood pressure', 'It inactivates the injection immediately', 'B'],
  [1, 'Which parameter is most associated with treatment dose?', 'Joules delivered to the tissue', 'Colour of the treatment room', 'Length of the power cable', 'Brand of safety goggles', 'A'],
  [1, 'If a patient reports excessive warmth during scanning, what should be done first?', 'Increase the power immediately', 'Slow the scanning speed and/or increase zoom / reduce power', 'Ignore the feedback and complete the dose', 'Switch to a surgical protocol', 'B'],
  [1, 'Which statement about wavelength is correct?', 'Longer wavelengths generally penetrate deeper than shorter ones', 'Wavelength has no effect on penetration', 'Only blue light reaches deep joints', 'All K-Laser wavelengths stop at the epidermis', 'A'],
  [2, 'What are the main contraindications of K-Laser treatment?', 'Eyes, known malignancy, and over the uterus of pregnant women', 'Tattoo only', 'Eczema or psoriasis anywhere on the body', 'Plates, wires, screws and titanium implants', 'A'],
  [2, 'Why is protective eyewear required during laser therapy treatments?', 'To prevent laser radiation from damaging the eyes', 'To improve the focus of the laser beam', 'To enhance treatment effectiveness', 'To reduce skin temperature during treatment', 'A'],
  [2, 'What are the Standard Operating Procedures for Class 4 laser?', 'Treat in a closed area, restrict access, display warning sign and wear specific safety eyewear', 'Open the door for ventilation throughout treatment', 'Allow relatives to observe without eyewear', 'Point the beam at reflective surfaces to check power', 'A'],
  [2, 'How should the handpiece be held for safety before and during treatment?', 'Like a pencil with the head toward the ground', 'Pointing upward toward the ceiling', 'Horizontally toward windows', 'Waved like a wand at eye level', 'A'],
  [2, 'What are the potential risks associated with non-invasive laser therapy?', 'Skin thinning only', 'Hyperpigmentation, burn and eye damage', 'Systemic allergic shock in every patient', 'Uncontrolled bleeding', 'B'],
  [2, 'Which precaution is important when performing laser therapy near sensitive areas?', 'Increase power to ensure deeper penetration', 'Avoid treating directly over the eyes', 'Ignore patient discomfort', 'Apply the laser continuously for more than 30 minutes', 'B'],
  [2, 'Which condition should be checked before initiating treatment?', 'Previous injuries only', 'Contraindications only', 'Recent surgeries only', 'Previous injuries, contraindications and recent surgeries', 'D'],
  [2, 'What should be displayed at the entrance of a Class 4 treatment area?', 'A laser warning sign', 'The clinic menu', 'Staff birthday list', 'A no-photography sticker only', 'A'],
  [2, 'Who must wear appropriate laser safety eyewear during emission?', 'Operator and patient (and anyone else in the controlled area)', 'Only the operator', 'Only the patient', 'Nobody if the door is closed', 'A'],
  [2, 'What is an appropriate action if the fibre or handpiece is damaged?', 'Continue treatment at lower power', 'Stop use and report the damage before treating', 'Wrap the fibre with tape and proceed', 'Ask the patient to hold the damaged section', 'B'],
  [3, 'What are the responsibilities of a certified laser practitioner in ensuring laser safety and quality?', 'Comply with procedures, inspect goggles/fibre/handpiece/cable, and implement SOP to minimize hazards', 'Only switch on the device', 'Only complete the invoice', 'Only clean the trolley once a month', 'A'],
  [3, 'How should a certified practitioner maintain the optic fibre in good condition?', 'Hang the fibre without using the cradle', 'Slam or pinch the fibre during treatment', 'Do not over-bend the fibre and gently roll it back without forcing', 'Pull the fibre under tension to straighten it', 'C'],
  [3, 'What does the yellow tag on the optic fibre indicate?', 'The fibre beginning', 'The maximum treatment power', 'The beam diameter', 'A signal to stop unwinding', 'D'],
  [3, 'What zoom number should be chosen when unsure of the correct spot size?', 'Always 1 for maximum intensity', 'Default 5 unless the protocol states otherwise', 'Always 10', 'Zoom is not used on Cube devices', 'B'],
  [3, 'Which daily inspection items should be performed before treatment?', 'Goggles, optic fibre, handpiece and power cable', 'Only the screen brightness', 'Only the clinic air-conditioning', 'None; annual service is sufficient', 'A'],
  [3, 'How should the fibre be stored after treatment?', 'Gently recoiled in the cradle without kinking', 'Folded tightly in a drawer', 'Left dangling off the trolley', 'Wrapped around the patient chair', 'A'],
  [3, 'What is one advantage of K-Laser therapy compared with traditional pain medication?', 'It requires hospital admission for every session', 'It provides non-invasive treatment with minimal side effects', 'It completely replaces all other medical care', 'It only works for cosmetic conditions', 'B'],
  [3, 'Which condition can commonly benefit from K-Laser therapy?', 'Muscle strains and ligament injuries', 'Appendicitis', 'Kidney stones as first-line treatment', 'Acute infections that require antibiotics as the only care', 'A'],
  [3, 'What should be done if the device reports an error mid-treatment?', 'Ignore it and continue the remaining joules', 'Stop emission, follow the on-screen guidance and do not bypass faults', 'Restart by pulling the power cord during emission', 'Ask the patient to tap the screen', 'B'],
  [3, 'Where should the handpiece rest when not treating?', 'In the designated holder with the beam directed to a safe area', 'On the patient\'s lap', 'On a reflective metal tray pointing up', 'In the practitioner\'s coat pocket while powered', 'A'],
  [4, 'What is the gliding method in K-Laser treatment?', 'Keep the handpiece fixed until time is completed', 'Use only scanning and never a stationary point', 'Glide in a scanning and/or controlled contact method over the treatment area throughout the dose', 'Use only a fixed method and never glide', 'C'],
  [4, 'How do you enhance laser absorption during treatment?', 'Remove bandage/clothes, clean gel/oil/water from the surface and hold the handpiece perpendicular to the skin', 'Hold the handpiece 3-5 cm away so the beam scatters', 'Apply extra gel or massage oil for gliding', 'Glide as slowly as possible even when the patient reports heat', 'A'],
  [4, 'When treating joints, what should the patient be encouraged to do?', 'Keep the joint completely locked', 'Move the joint slightly (active ROM) as appropriate', 'Apply ice throughout laser emission', 'Look directly at the beam to confirm it is working', 'B'],
  [4, 'When treating a lower limb, which direction should treatment generally proceed?', 'Proximal to distal, or following the muscle fibre', 'Distal to proximal only', 'In random circles only', 'Only on the opposite limb', 'A'],
  [4, 'How should scanning speed be adapted during treatment?', 'Use the same speed for every patient', 'Randomly', 'Always the slowest possible speed', 'Based on the warmth felt by the patient', 'D'],
  [4, 'What should be done before treating a wound with laser therapy?', 'Ice the area until numb', 'Cover the wound with a thick dressing and treat through it without assessment', 'Clean the wound and surrounding skin', 'Apply ointment first so the beam reflects', 'C'],
  [4, 'What is an appropriate technique for contact mode on muscles?', 'Stay on a single fixed point for the entire dose', 'Use the tip to apply appropriate pressure and massage along the tissue', 'Keep the laser motionless 20 cm away', 'Treat from across the room', 'B'],
  [4, 'How can K-Laser treatment results be improved?', 'Treat nerve roots and work proximal to distal, diagnose accurately, choose the right protocol and add active ROM where suitable', 'Always use maximum power regardless of skin type', 'Skip the safety briefing to save time', 'Treat only the painful spot and ignore referred patterns', 'A'],
  [4, 'Which statement about tattoos in the treatment field is correct?', 'Dark ink can absorb more energy; treat with caution and adjust parameters', 'Tattoos block all laser energy so treatment is impossible', 'Tattoos are a reason to increase power', 'Tattoos are irrelevant to dosing', 'A'],
  [4, 'If treating over a hairy area, what is the better practice?', 'Clip or part hair so energy reaches the skin, and keep the handpiece moving', 'Burn the hair with a high, stationary beam', 'Skip PPE because hair protects the eyes', 'Soak the hair in oil first', 'A']
];

function parseArgs(argv) {
  const args = {
    preset: 'large',
    reset: false,
    yes: false,
    wipeSettings: false,
    seed: 20260817,
    password: SEED_PASSWORD
  };
  for (const raw of argv) {
    if (raw === '--reset') args.reset = true;
    else if (raw === '--yes' || raw === '-y') args.yes = true;
    else if (raw === '--wipe-settings') args.wipeSettings = true;
    else if (raw.startsWith('--preset=')) args.preset = raw.slice(9);
    else if (raw.startsWith('--seed=')) args.seed = Number(raw.slice(7)) || args.seed;
    else if (raw.startsWith('--password=')) args.password = raw.slice(11);
    else if (raw.startsWith('--trainees=')) args.trainees = Number(raw.slice(11));
    else if (raw.startsWith('--trainings=')) args.trainings = Number(raw.slice(12));
  }
  if (!PRESETS[args.preset]) {
    throw new Error(`Unknown preset "${args.preset}". Use small, medium, large or xlarge.`);
  }
  const preset = { ...PRESETS[args.preset] };
  if (Number.isInteger(args.trainees) && args.trainees > 0) preset.trainees = args.trainees;
  if (Number.isInteger(args.trainings) && args.trainings > 0) preset.trainings = args.trainings;
  args.counts = preset;
  return args;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function pickN(rng, list, n) {
  const copy = [...list];
  const out = [];
  const count = Math.min(n, copy.length);
  for (let i = 0; i < count; i += 1) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function chance(rng, probability) {
  return rng() < probability;
}

function shuffle(rng, items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pad(num, size) {
  return String(num).padStart(size, '0');
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

function formatDateTime(date) {
  return `${formatDate(date)} ${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}:${pad(date.getUTCSeconds(), 2)}`;
}

function formatDisplayDate(date) {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addYears(date, years) {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function skipWeekend(date) {
  const next = new Date(date.getTime());
  while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function atTime(date, hours, minutes) {
  const next = new Date(date.getTime());
  next.setUTCHours(hours, minutes, 0, 0);
  return next;
}

function randomBirthDate(rng) {
  const year = randomInt(rng, 1968, 2001);
  const month = randomInt(rng, 1, 12);
  const day = randomInt(rng, 1, 28);
  return { year, month, day };
}

function makeIc(rng, gender) {
  const { year, month, day } = randomBirthDate(rng);
  const yy = pad(year % 100, 2);
  const last = gender === 'male' ? randomInt(rng, 0, 4) * 2 + 1 : randomInt(rng, 0, 4) * 2;
  return `${yy}${pad(month, 2)}${pad(day, 2)}-${pick(rng, STATE_CODES)}-${pad(randomInt(rng, 0, 99), 2)}${last}`;
}

function makePhone(rng) {
  const prefix = pick(rng, MOBILE_PREFIXES);
  const rest = prefix === '11'
    ? `${randomInt(rng, 1000, 9999)}${randomInt(rng, 100, 999)}`
    : `${randomInt(rng, 100, 999)}${randomInt(rng, 1000, 9999)}`;
  return `+60${prefix}${rest}`.slice(0, 20);
}

function makePerson(rng, index) {
  const gender = chance(rng, 0.58) ? 'female' : 'male';
  const roll = rng();
  let firstName;
  let lastName;
  if (roll < 0.52) {
    firstName = gender === 'male' ? pick(rng, MALAY_FIRST_M) : pick(rng, MALAY_FIRST_F);
    if (firstName === 'Nur' || firstName === 'Siti' || firstName === 'Mohd' || firstName === 'Muhammad') {
      firstName = `${firstName} ${pick(rng, gender === 'male' ? ['Hafiz', 'Hakim', 'Faiz', 'Iman', 'Syah'] : ['Aisyah', 'Hana', 'Aina', 'Farah', 'Sofea'])}`;
    }
    lastName = `${gender === 'male' ? 'bin' : 'binti'} ${pick(rng, MALAY_LAST)}`;
  } else if (roll < 0.82) {
    lastName = pick(rng, CHINESE_SURNAMES);
    firstName = gender === 'male' ? pick(rng, CHINESE_GIVEN_M) : pick(rng, CHINESE_GIVEN_F);
  } else {
    firstName = gender === 'male' ? pick(rng, INDIAN_FIRST_M) : pick(rng, INDIAN_FIRST_F);
    lastName = `${gender === 'male' ? 'A/L' : 'A/P'} ${pick(rng, INDIAN_LAST)}`;
  }
  return { firstName, lastName, gender, index };
}

function wrongAnswer(correct, rng) {
  const options = ['A', 'B', 'C', 'D'].filter((opt) => opt !== correct);
  return pick(rng, options);
}

function scoreProfile(rng, bias = 'completed') {
  const roll = rng();
  if (bias === 'completed') {
    if (roll < 0.12) return 'fail';
    if (roll < 0.27) return 'borderline';
    return 'high';
  }
  if (roll < 0.18) return 'fail';
  if (roll < 0.40) return 'borderline';
  return 'high';
}

function targetFor(profile, passing, rng, spread = 'normal') {
  if (profile === 'borderline') return passing + randomInt(rng, 0, 3);
  if (profile === 'fail') return randomInt(rng, Math.max(28, passing - 22), passing - 1);
  if (spread === 'pre') return randomInt(rng, Math.max(40, passing - 25), passing - 2);
  return randomInt(rng, Math.min(100, passing + 6), 100);
}

function correctCount(total, percent) {
  return Math.min(total, Math.max(0, Math.round((total * percent) / 100)));
}

async function insertMany(conn, table, columns, rows, batchSize = 250) {
  if (!rows.length) return [];
  const ids = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const placeholders = chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const values = [];
    for (const row of chunk) {
      for (const column of columns) values.push(row[column] ?? null);
    }
    const [result] = await conn.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`,
      values
    );
    for (let j = 0; j < chunk.length; j += 1) {
      ids.push(result.insertId + j);
    }
  }
  return ids;
}

async function upsertNamed(conn, table, nameColumn, rows, extraColumns = []) {
  const existing = new Map();
  const [current] = await conn.query(`SELECT id, ${nameColumn} AS name FROM ${table}`);
  for (const row of current) existing.set(String(row.name).toLowerCase(), row.id);
  const inserted = [];
  for (const row of rows) {
    const key = String(row[nameColumn]).toLowerCase();
    if (existing.has(key)) {
      inserted.push(existing.get(key));
      continue;
    }
    const columns = [nameColumn, ...extraColumns];
    const values = columns.map((column) => row[column] ?? null);
    const [result] = await conn.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );
    existing.set(key, result.insertId);
    inserted.push(result.insertId);
  }
  const [all] = await conn.query(`SELECT * FROM ${table} ORDER BY id`);
  return all;
}

async function wipeOperational(conn, { wipeSettings }) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of OPERATIONAL_TABLES) {
    await conn.query(`TRUNCATE TABLE ${table}`);
  }
  await conn.query(
    `DELETE FROM users WHERE email NOT IN (?, ?)`,
    ['admin@lms.com', 'trainer@lms.com']
  );
  if (wipeSettings) {
    for (const table of SETTINGS_TABLES) {
      await conn.query(`TRUNCATE TABLE ${table}`);
    }
    await conn.query('DELETE FROM users');
  }
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

function buildTrainee(rng, index, usedIds, usedEmails, hospitals, designations, serials, passwordHash) {
  const person = makePerson(rng, index);
  let traineeId = `T${randomInt(rng, 100000, 999999)}`;
  while (usedIds.has(traineeId)) traineeId = `T${randomInt(rng, 100000, 999999)}`;
  usedIds.add(traineeId);

  const emailBase = `${slug(person.firstName)}.${slug(person.lastName).replace(/^(bin|binti|a\.l|a\.p)\./, '')}`;
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', EMAIL_DOMAIN];
  let email = `${emailBase}.${index}@${pick(rng, domains)}`;
  let n = 2;
  while (usedEmails.has(email)) {
    email = `${emailBase}.${index}.${n}@${pick(rng, domains)}`;
    n += 1;
  }
  usedEmails.add(email);

  const hospital = chance(rng, 0.93) ? pick(rng, hospitals) : null;
  const designation = pick(rng, designations);
  const serial = hospital && chance(rng, 0.55) ? pick(rng, serials.filter((item) => item.hospitalId === hospital.id).concat(serials)) : null;
  const statusRoll = rng();
  const status = statusRoll < 0.08 ? 'registered' : statusRoll < 0.12 ? 'inactive' : statusRoll < 0.13 ? 'suspended' : 'active';

  return {
    trainee_id: traineeId,
    first_name: person.firstName,
    last_name: person.lastName,
    ic_passport: makeIc(rng, person.gender),
    email,
    password: passwordHash,
    handphone_number: makePhone(rng),
    healthcare_id: hospital ? hospital.id : null,
    designation_id: designation.id,
    device_serial_number_id: serial && serial.id ? serial.id : null,
    first_training: null,
    latest_training: null,
    recertification_date: null,
    number_of_completed_trainings: 0,
    trainee_status: status,
    gender: person.gender
  };
}

function selectQuestions(rng, bank, testType, total) {
  const byObjective = new Map();
  for (const question of bank.filter((item) => item.test_type === testType)) {
    const list = byObjective.get(question.objective_id) || [];
    list.push(question);
    byObjective.set(question.objective_id, list);
  }
  const selected = [];
  const used = new Set();
  for (const questions of byObjective.values()) {
    const shuffled = shuffle(rng, questions);
    for (const question of shuffled.slice(0, 2)) {
      selected.push(question);
      used.add(question.id);
    }
  }
  const remaining = shuffle(
    rng,
    bank.filter((item) => item.test_type === testType && !used.has(item.id))
  );
  for (const question of remaining) {
    if (selected.length >= total) break;
    selected.push(question);
  }
  return shuffle(rng, selected.slice(0, total));
}

function buildAttemptAnswers(rng, questions, percent) {
  const needCorrect = correctCount(questions.length, percent);
  const flags = shuffle(rng, questions.map((_, index) => index < needCorrect));
  const answers = questions.map((question, index) => {
    const isCorrect = flags[index];
    return {
      question_id: question.id,
      objective_id: question.objective_id,
      selected_answer: isCorrect ? question.correct_answer : wrongAnswer(question.correct_answer, rng),
      is_correct: isCorrect ? 1 : 0
    };
  });
  const correct = answers.filter((item) => item.is_correct).length;
  return {
    answers,
    score: questions.length ? Number(((correct / questions.length) * 100).toFixed(2)) : 0,
    total: questions.length
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rng = mulberry32(args.seed);
  const counts = args.counts;
  const now = new Date('2026-08-17T08:00:00Z');
  const rangeStart = new Date('2023-03-01T00:00:00Z');

  console.log('LMS fake-data seeder');
  console.log(`Preset: ${args.preset}  |  trainees: ${counts.trainees}  |  trainings: ${counts.trainings}  |  seed: ${args.seed}`);
  if (args.reset) {
    if (!args.yes) {
      console.error('Refusing to wipe data without --yes. Example: npm run seed:fake -- --reset --yes');
      process.exit(1);
    }
    console.log(`Reset: yes${args.wipeSettings ? ' (including settings)' : ' (keeping hospitals/settings if present)'}`);
  }

  const passwordHash = await bcrypt.hash(args.password, 10);
  const conn = await pool.getConnection();

  try {
    if (args.reset) {
      console.log('Wiping operational tables...');
      await wipeOperational(conn, { wipeSettings: args.wipeSettings });
    }

    await conn.beginTransaction();

    console.log('Seeding settings...');
    const objectives = await upsertNamed(conn, 'objectives', 'name', OBJECTIVES, ['description']);
    const objectiveByName = new Map(objectives.map((row) => [row.name, row]));
    const designations = await upsertNamed(conn, 'designations', 'name', DESIGNATIONS, ['description']);
    const areas = await upsertNamed(conn, 'areas_of_specialization', 'name', AREAS, ['description']);
    const modules = await upsertNamed(conn, 'modules', 'name', MODULES, ['description']);
    const deviceModels = await upsertNamed(conn, 'device_models', 'model_name', DEVICE_MODELS, ['description']);
    await upsertNamed(conn, 'training_titles', 'name', TRAINING_TITLES, ['description']);
    await upsertNamed(conn, 'practical_learning_outcomes_settings', 'aspect_name', PLO_ASPECTS, ['description', 'max_score']);

    const hospitalRows = HOSPITALS.slice(0, counts.hospitals).map(([name, hospital_address]) => ({
      name,
      hospital_address,
      training_reminder_interval: pick(rng, ['1_year', '2_years', '2_years', '2_years', '3_years']),
      training_reminder_due_date: null
    }));
    const hospitals = await upsertNamed(conn, 'healthcare', 'name', hospitalRows, [
      'hospital_address',
      'training_reminder_interval',
      'training_reminder_due_date'
    ]);

    const [existingAdmins] = await conn.query('SELECT id, email, role FROM users');
    const userByEmail = new Map(existingAdmins.map((row) => [row.email.toLowerCase(), row]));
    if (!userByEmail.has('admin@lms.com')) {
      await conn.query(
        `INSERT INTO users (email, password, first_name, last_name, position, phone_number, area_of_specialization, role)
         VALUES (?, ?, 'Admin', 'User', 'System Administrator', ?, 'LMS operations', 'admin')`,
        ['admin@lms.com', passwordHash, makePhone(rng)]
      );
    }
    if (!userByEmail.has('trainer@lms.com')) {
      await conn.query(
        `INSERT INTO users (email, password, first_name, last_name, position, phone_number, area_of_specialization, role)
         VALUES (?, ?, 'John', 'Trainer', 'Senior Clinical Trainer', ?, 'Photobiomodulation', 'trainer')`,
        ['trainer@lms.com', passwordHash, makePhone(rng)]
      );
    }

    const trainerCount = Math.min(counts.trainers, TRAINER_PROFILES.length);
    for (let i = 0; i < trainerCount; i += 1) {
      const [first, last, position, spec] = TRAINER_PROFILES[i];
      const email = `${slug(first)}.${slug(last)}@quickstopsolution.com`;
      if (userByEmail.has(email)) continue;
      const role = position.toLowerCase().includes('administrator') ? 'admin' : 'trainer';
      await conn.query(
        `INSERT INTO users (email, password, first_name, last_name, position, phone_number, area_of_specialization, role)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [email, passwordHash, first, last, position, makePhone(rng), spec, role]
      );
    }

    const [users] = await conn.query('SELECT id, email, role, first_name, last_name FROM users ORDER BY id');
    const admins = users.filter((user) => user.role === 'admin');
    const trainers = users.filter((user) => user.role === 'trainer');
    const adminId = admins[0]?.id || trainers[0].id;

    console.log('Seeding device serials...');
    const [existingSerials] = await conn.query('SELECT id, serial_number, device_model_id FROM device_serial_numbers');
    const usedSerials = new Set(existingSerials.map((row) => row.serial_number));
    const serialRows = [];
    while (serialRows.length + existingSerials.length < counts.serials) {
      const model = pick(rng, deviceModels);
      const hospital = pick(rng, hospitals);
      const year = randomInt(rng, 21, 26);
      const serial = `KL${String(model.model_name).replace(/\D/g, '').slice(0, 2) || '4'}${year}${pad(randomInt(rng, 1, 99999), 5)}`;
      if (usedSerials.has(serial)) continue;
      usedSerials.add(serial);
      serialRows.push({
        serial_number: serial,
        device_model_id: model.id,
        notes: `Installed at ${hospital.name}`,
        hospitalId: hospital.id
      });
    }
    const newSerialIds = await insertMany(conn, 'device_serial_numbers', ['serial_number', 'device_model_id', 'notes'], serialRows);
    const serials = [
      ...existingSerials.map((row) => ({ ...row, hospitalId: pick(rng, hospitals).id })),
      ...serialRows.map((row, index) => ({ id: newSerialIds[index], ...row }))
    ];

    console.log('Seeding question bank...');
    const [existingQuestionCount] = await conn.query('SELECT COUNT(*) AS cnt FROM questions');
    const questionRecords = [];
    if (Number(existingQuestionCount[0].cnt) < modules.length * 3 * 40) {
      for (const module of modules) {
        for (const testType of ['pre_test', 'post_test', 'certificate_enrolment']) {
          for (const [objectiveIndex, text, a, b, c, d, correct] of QUESTION_BANK) {
            questionRecords.push({
              question_text: text,
              option_a: a,
              option_b: b,
              option_c: c,
              option_d: d,
              correct_answer: correct,
              test_type: testType,
              module_id: module.id,
              objective_id: objectiveByName.get(OBJECTIVES[objectiveIndex].name).id,
              training_id: null,
              created_by: adminId
            });
          }
        }
      }
      await insertMany(conn, 'questions', [
        'question_text', 'option_a', 'option_b', 'option_c', 'option_d',
        'correct_answer', 'test_type', 'module_id', 'objective_id', 'training_id', 'created_by'
      ], questionRecords, 200);
    }
    const [questionRows] = await conn.query(
      'SELECT id, test_type, module_id, objective_id, correct_answer FROM questions'
    );
    const questionsByModule = new Map();
    for (const question of questionRows) {
      const key = `${question.module_id}`;
      const list = questionsByModule.get(key) || [];
      list.push(question);
      questionsByModule.set(key, list);
    }

    console.log('Seeding trainees...');
    const [existingTraineeRows] = await conn.query('SELECT trainee_id, email FROM trainees');
    const usedIds = new Set(existingTraineeRows.map((row) => row.trainee_id));
    const usedEmails = new Set(existingTraineeRows.map((row) => row.email.toLowerCase()));
    const traineePayload = [];
    const indexOffset = existingTraineeRows.length;
    for (let i = 0; i < counts.trainees; i += 1) {
      traineePayload.push(buildTrainee(
        rng,
        indexOffset + i + 1,
        usedIds,
        usedEmails,
        hospitals,
        designations,
        serials,
        passwordHash
      ));
    }
    const traineeIds = await insertMany(conn, 'trainees', [
      'trainee_id', 'first_name', 'last_name', 'ic_passport', 'email', 'password',
      'handphone_number', 'healthcare_id', 'designation_id', 'device_serial_number_id',
      'first_training', 'latest_training', 'recertification_date',
      'number_of_completed_trainings', 'trainee_status'
    ], traineePayload, 150);
    const trainees = traineePayload.map((row, index) => ({ id: traineeIds[index], ...row }));

    const areaLinks = [];
    for (const trainee of trainees) {
      const chosen = pickN(rng, areas, randomInt(rng, 1, 3));
      for (const area of chosen) {
        areaLinks.push({ trainee_id: trainee.id, area_of_specialization_id: area.id });
      }
    }
    await insertMany(conn, 'trainee_area_of_specializations', ['trainee_id', 'area_of_specialization_id'], areaLinks, 300);
    await conn.commit();

    const traineesByHospital = new Map();
    for (const trainee of trainees) {
      if (!trainee.healthcare_id) continue;
      const list = traineesByHospital.get(trainee.healthcare_id) || [];
      list.push(trainee);
      traineesByHospital.set(trainee.healthcare_id, list);
    }

    console.log('Seeding trainings, enrollments, tests and certificates...');
    const hospitalQueue = shuffle(rng, hospitals.filter((hospital) => (traineesByHospital.get(hospital.id) || []).length >= 4));
    const stats = {
      trainings: 0,
      enrollments: 0,
      attempts: 0,
      answers: 0,
      certificates: 0,
      overrides: 0,
      notifications: 0
    };

    for (let t = 0; t < counts.trainings; t += 1) {
      await conn.beginTransaction();
      const title = pick(rng, TRAINING_TITLES);
      const module = pick(rng, modules);
      const deviceModel = pick(rng, deviceModels);
      const company = chance(rng, 0.72) ? 'QSS' : 'PMS';
      const dayCount = chance(rng, 0.7) ? 1 : 2;
      const startDay = skipWeekend(addDays(rangeStart, Math.floor(rng() * 1250)));
      const start = atTime(startDay, 9, 0);
      const end = atTime(addDays(startDay, dayCount - 1), 17, 0);
      const isFuture = start > now;
      const isRecent = !isFuture && addDays(end, 21) > now;
      let status = 'completed';
      if (isFuture) status = chance(rng, 0.1) ? 'rescheduled' : 'in_progress';
      else if (chance(rng, 0.07)) status = 'canceled';
      else if (isRecent && chance(rng, 0.35)) status = 'in_progress';
      else if (chance(rng, 0.04)) status = 'rescheduled';
      const isLocked = status === 'completed' && chance(rng, 0.7) ? 1 : 0;
      const createdBy = chance(rng, 0.35) ? adminId : pick(rng, trainers).id;
      const createdAt = addDays(start, -randomInt(rng, 10, 40));

      const [trainingResult] = await conn.query(
        `INSERT INTO trainings
          (title, description, type, module_id, device_model_id, created_by, affiliated_company,
           status, is_locked, start_datetime, end_datetime, header_image, created_at)
         VALUES (?, ?, 'main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          title.name,
          title.description,
          module.id,
          deviceModel.id,
          createdBy,
          company,
          status,
          isLocked,
          formatDateTime(start),
          formatDateTime(end),
          pick(rng, HEADER_IMAGES),
          formatDateTime(createdAt)
        ]
      );
      const trainingId = trainingResult.insertId;
      stats.trainings += 1;

      const siteCount = chance(rng, 0.18) ? randomInt(rng, 2, 3) : 1;
      const sites = [];
      if (hospitalQueue.length) {
        sites.push(hospitalQueue[t % hospitalQueue.length]);
      } else {
        sites.push(pick(rng, hospitals));
      }
      while (sites.length < siteCount) {
        const extra = pick(rng, hospitals);
        if (!sites.some((site) => site.id === extra.id)) sites.push(extra);
      }
      await insertMany(conn, 'training_healthcare', ['training_id', 'healthcare_id'],
        sites.map((site) => ({ training_id: trainingId, healthcare_id: site.id })));

      const assignedTrainers = pickN(rng, trainers, randomInt(rng, 1, Math.min(3, trainers.length)));
      await insertMany(conn, 'training_trainers', ['training_id', 'trainer_id'],
        assignedTrainers.map((trainer) => ({ training_id: trainingId, trainer_id: trainer.id })));

      const siteSerials = serials.filter((serial) => serial.device_model_id === deviceModel.id);
      const trainingSerials = pickN(rng, siteSerials.length ? siteSerials : serials, randomInt(rng, 1, 3));
      await insertMany(conn, 'training_devices', ['training_id', 'device_serial_number_id', 'custom_serial_number'],
        trainingSerials.map((serial) => ({
          training_id: trainingId,
          device_serial_number_id: serial.id,
          custom_serial_number: null
        })));

      await insertMany(conn, 'practical_learning_outcomes', ['training_id', 'aspect_name', 'description', 'max_score'],
        PLO_ASPECTS.map((aspect) => ({
          training_id: trainingId,
          aspect_name: aspect.aspect_name,
          description: null,
          max_score: aspect.max_score
        })));
      const [aspectRows] = await conn.query(
        'SELECT id, max_score FROM practical_learning_outcomes WHERE training_id = ? ORDER BY id',
        [trainingId]
      );

      for (let s = 0; s < SECTION_TEMPLATES.length; s += 1) {
        const section = SECTION_TEMPLATES[s];
        const [sectionResult] = await conn.query(
          'INSERT INTO training_sections (training_id, title, section_order) VALUES (?, ?, ?)',
          [trainingId, section.title, s + 1]
        );
        await insertMany(conn, 'training_materials',
          ['section_id', 'title', 'type', 'file_path', 'url', 'material_order', 'uploaded_by', 'visibility'],
          section.materials.map((material, index) => ({
            section_id: sectionResult.insertId,
            title: material.title,
            type: material.type,
            file_path: material.file_path || null,
            url: material.url || null,
            material_order: index + 1,
            uploaded_by: createdBy,
            visibility: index === 0 ? 'public' : 'private'
          })));
      }
      const [materialRows] = await conn.query(
        `SELECT tm.id FROM training_materials tm
         JOIN training_sections ts ON ts.id = tm.section_id
         WHERE ts.training_id = ?`,
        [trainingId]
      );

      const moduleQuestions = questionsByModule.get(String(module.id)) || questionRows;
      const tests = [
        { type: 'pre_test', count: 10 },
        { type: 'post_test', count: 10 },
        { type: 'certificate_enrolment', count: 40 }
      ];
      const questionsByTest = {};
      for (const test of tests) {
        const selected = selectQuestions(rng, moduleQuestions, test.type, test.count);
        const [testResult] = await conn.query(
          'INSERT INTO training_tests (training_id, test_type, total_questions) VALUES (?, ?, ?)',
          [trainingId, test.type, selected.length]
        );
        await insertMany(conn, 'training_test_questions', ['training_test_id', 'question_id', 'question_order'],
          selected.map((question, index) => ({
            training_test_id: testResult.insertId,
            question_id: question.id,
            question_order: index + 1
          })));
        questionsByTest[test.type] = selected;
      }

      const poolForTraining = [];
      for (const site of sites) {
        poolForTraining.push(...(traineesByHospital.get(site.id) || []));
      }
      const uniquePool = [...new Map(poolForTraining.map((trainee) => [trainee.id, trainee])).values()]
        .filter((trainee) => trainee.trainee_status !== 'suspended');
      const fallbackPool = trainees.filter((trainee) => trainee.trainee_status === 'active');
      const enrollCount = Math.min(
        uniquePool.length || fallbackPool.length,
        randomInt(rng, 8, status === 'canceled' ? 12 : 22)
      );
      const enrolled = pickN(rng, uniquePool.length ? uniquePool : fallbackPool, enrollCount);

      await insertMany(conn, 'training_trainees', ['training_id', 'trainee_id'],
        enrolled.map((trainee) => ({ training_id: trainingId, trainee_id: trainee.id })));

      const enrollmentRows = enrolled.map((trainee) => {
        let enrollmentStatus = 'completed';
        if (status === 'canceled') enrollmentStatus = chance(rng, 0.6) ? 'dropped' : 'active';
        else if (status === 'in_progress' || status === 'rescheduled') enrollmentStatus = chance(rng, 0.08) ? 'dropped' : 'active';
        else if (chance(rng, 0.04)) enrollmentStatus = 'dropped';
        return {
          trainee,
          trainee_id: trainee.id,
          training_id: trainingId,
          status: enrollmentStatus,
          can_download_results: 0,
          healthcare_id_at_enrollment: trainee.healthcare_id,
          enrolled_at: formatDateTime(addDays(start, -randomInt(rng, 3, 21)))
        };
      });
      const enrollmentIds = await insertMany(conn, 'enrollments', [
        'trainee_id', 'training_id', 'enrolled_at', 'status', 'can_download_results', 'healthcare_id_at_enrollment'
      ], enrollmentRows);
      enrollmentRows.forEach((row, index) => {
        row.id = enrollmentIds[index];
      });
      stats.enrollments += enrollmentRows.length;

      const attendanceRows = [];
      const attemptRows = [];
      const attemptMeta = [];
      const ploScoreRows = [];
      const gradeRows = [];
      const certificateRows = [];
      const overrideRows = [];
      const notificationRows = [];
      const accessRows = [];
      const downloadUpdates = [];

      for (const enrollment of enrollmentRows) {
        const profile = scoreProfile(rng, status === 'completed' ? 'completed' : 'open');
        const evaluator = pick(rng, assignedTrainers).id;
        const sessionDates = [];
        for (let d = 0; d < dayCount; d += 1) sessionDates.push(addDays(startDay, d));

        if (enrollment.status !== 'dropped') {
          for (const sessionDate of sessionDates) {
            const attRoll = rng();
            const attStatus = attRoll < 0.08 ? 'absent' : attRoll < 0.18 ? 'late' : 'present';
            const time = attStatus === 'late' ? '09:18:00' : attStatus === 'absent' ? null : '08:55:00';
            attendanceRows.push({
              enrollment_id: enrollment.id,
              date: formatDate(sessionDate),
              time,
              duration: attStatus === 'absent' ? 0 : attStatus === 'late' ? 6.5 : dayCount === 1 ? 7.5 : 7.0,
              status: attStatus,
              marked_by: evaluator,
              notes: attStatus === 'present' ? pick(rng, ATTENDANCE_NOTES) : (attStatus === 'late' ? 'Arrived after clinic handover.' : 'Unable to attend full session.')
            });
          }
        }

        const shouldAttempt = enrollment.status !== 'dropped' && status !== 'canceled';
        let progress = 'none';
        if (shouldAttempt) {
          if (status === 'completed') progress = 'all';
          else if (status === 'in_progress') {
            const roll = rng();
            progress = roll < 0.28 ? 'none' : roll < 0.55 ? 'pre' : roll < 0.78 ? 'post' : 'all';
          } else {
            progress = chance(rng, 0.3) ? 'pre' : 'none';
          }
        }

        const testPlan = [];
        if (progress === 'pre' || progress === 'post' || progress === 'all') testPlan.push('pre_test');
        if (progress === 'post' || progress === 'all') testPlan.push('post_test');
        if (progress === 'all') testPlan.push('certificate_enrolment');

        const attemptScores = {};
        for (const testType of testPlan) {
          const passing = testType === 'certificate_enrolment' ? 70 : 80;
          const spread = testType === 'pre_test' && profile === 'high' ? 'pre' : 'normal';
          const percent = targetFor(profile, passing, rng, spread);
          const built = buildAttemptAnswers(rng, questionsByTest[testType], percent);
          const completedAt = addDays(start, testType === 'pre_test' ? 0 : testType === 'post_test' ? dayCount - 1 : dayCount);
          attemptMeta.push({
            enrollment,
            testType,
            profile,
            built,
            completedAt: atTime(completedAt, testType === 'pre_test' ? 9 : 15, randomInt(rng, 5, 50))
          });
          attemptScores[testType] = built.score;
        }

        if (progress === 'all' || (status === 'completed' && enrollment.status === 'completed')) {
          for (const aspect of aspectRows) {
            const passing = 70;
            const percent = targetFor(profile, passing, rng);
            const score = Number(((Number(aspect.max_score) * percent) / 100).toFixed(2));
            ploScoreRows.push({
              enrollment_id: enrollment.id,
              aspect_id: aspect.id,
              score,
              evaluated_by: evaluator,
              comments: pick(rng, PLO_COMMENTS[profile]),
              percent
            });
          }
        }

        const certScore = attemptScores.certificate_enrolment;
        const practicalPct = ploScoreRows.some((row) => row.enrollment_id === enrollment.id)
          ? ploScoreRows.filter((row) => row.enrollment_id === enrollment.id)
            .reduce((sum, row) => sum + (Number(row.score) / 10) * 100, 0) /
            ploScoreRows.filter((row) => row.enrollment_id === enrollment.id).length
          : null;

        const passedCert = certScore != null && certScore >= 70;
        const passedPractical = practicalPct == null ? false : practicalPct >= 70;
        const eligible = passedCert && passedPractical;
        const needsOverride = certScore != null && !passedCert && passedPractical && chance(rng, 0.35);
        const releaseResults = (status === 'completed' && enrollment.status === 'completed' && (eligible || needsOverride))
          || (status === 'in_progress' && eligible && chance(rng, 0.35));

        if (certScore != null && practicalPct != null) {
          const objectiveBuckets = {};
          for (const meta of attemptMeta.filter((item) => item.enrollment.id === enrollment.id && ['post_test', 'certificate_enrolment'].includes(item.testType))) {
            for (const answer of meta.built.answers) {
              if (!answer.objective_id) continue;
              if (!objectiveBuckets[answer.objective_id]) objectiveBuckets[answer.objective_id] = { total: 0, correct: 0 };
              objectiveBuckets[answer.objective_id].total += 1;
              if (answer.is_correct) objectiveBuckets[answer.objective_id].correct += 1;
            }
          }
          const objectiveValues = Object.values(objectiveBuckets);
          const understanding = objectiveValues.length
            ? objectiveValues.reduce((sum, item) => sum + (item.correct / item.total) * 100, 0) / objectiveValues.length
            : null;
          gradeRows.push({
            enrollment_id: enrollment.id,
            training_grade: Number(((practicalPct * 0.6) + (certScore * 0.4)).toFixed(2)),
            endorsement_grade: certScore,
            objective_understanding_percentage: understanding == null ? null : Number(understanding.toFixed(2)),
            hands_on_grade: Number(practicalPct.toFixed(2))
          });
        }

        if ((eligible || needsOverride) && (status === 'completed' || releaseResults)) {
          const issuedAt = addDays(end, randomInt(rng, 0, 4));
          const validityEnd = addYears(issuedAt, 2);
          const participantName = `${enrollment.trainee.first_name} ${enrollment.trainee.last_name}`;
          const location = sites[0]?.name || 'N/A';
          certificateRows.push({
            enrollment_id: enrollment.id,
            training_id: trainingId,
            trainee_id: enrollment.trainee_id,
            healthcare_id_at_issue: enrollment.healthcare_id_at_enrollment,
            certificate_number: `1000-${trainingId}-${enrollment.id}`,
            issued_at: formatDateTime(issuedAt),
            validity_start: formatDate(issuedAt),
            validity_end: formatDate(validityEnd),
            participant_name: participantName,
            course_name: title.name,
            location,
            date_display: formatDisplayDate(end)
          });
          if (needsOverride) {
            overrideRows.push({
              enrollment_id: enrollment.id,
              training_id: trainingId,
              trainee_id: enrollment.trainee_id,
              certificate_enrolment_score: certScore,
              justification: pick(rng, OVERRIDE_REASONS),
              released_by: evaluator,
              released_at: formatDateTime(addDays(end, 1))
            });
          }
        }

        if (progress === 'all' && !releaseResults && status === 'in_progress' && certScore != null) {
          notificationRows.push({
            enrollment,
            certScore
          });
        }

        if (releaseResults) downloadUpdates.push(enrollment.id);

        if (enrollment.status !== 'dropped' && materialRows.length && chance(rng, 0.8)) {
          for (const material of pickN(rng, materialRows, randomInt(rng, 1, materialRows.length))) {
            accessRows.push({
              material_id: material.id,
              enrollment_id: enrollment.id,
              access_count: randomInt(rng, 1, 6)
            });
          }
        }

        enrollment._profile = profile;
        enrollment._progress = progress;
      }

      if (attendanceRows.length) {
        await insertMany(conn, 'attendance',
          ['enrollment_id', 'date', 'time', 'duration', 'status', 'marked_by', 'notes'],
          attendanceRows, 300);
      }

      if (attemptMeta.length) {
        const attemptIds = await insertMany(conn, 'test_attempts',
          ['enrollment_id', 'test_type', 'score', 'total_questions', 'started_at', 'completed_at', 'status'],
          attemptMeta.map((meta) => ({
            enrollment_id: meta.enrollment.id,
            test_type: meta.testType,
            score: meta.built.score,
            total_questions: meta.built.total,
            started_at: formatDateTime(addDays(meta.completedAt, 0)),
            completed_at: formatDateTime(meta.completedAt),
            status: 'completed'
          })), 200);
        stats.attempts += attemptIds.length;

        const answerRows = [];
        const objectiveScoreMap = new Map();
        attemptMeta.forEach((meta, index) => {
          meta.attemptId = attemptIds[index];
          for (const answer of meta.built.answers) {
            answerRows.push({
              attempt_id: meta.attemptId,
              question_id: answer.question_id,
              selected_answer: answer.selected_answer,
              is_correct: answer.is_correct
            });
            if (['post_test', 'certificate_enrolment'].includes(meta.testType) && answer.objective_id) {
              const key = `${meta.enrollment.id}:${answer.objective_id}:${meta.testType}`;
              const current = objectiveScoreMap.get(key) || {
                enrollment_id: meta.enrollment.id,
                objective_id: answer.objective_id,
                test_type: meta.testType,
                questions_answered: 0,
                questions_correct: 0
              };
              current.questions_answered += 1;
              if (answer.is_correct) current.questions_correct += 1;
              objectiveScoreMap.set(key, current);
            }
          }
        });
        if (answerRows.length) {
          await insertMany(conn, 'test_answers',
            ['attempt_id', 'question_id', 'selected_answer', 'is_correct'],
            answerRows, 400);
          stats.answers += answerRows.length;
        }
        const objectiveRows = [...objectiveScoreMap.values()].map((row) => ({
          ...row,
          understanding_percentage: Number(((row.questions_correct / row.questions_answered) * 100).toFixed(2))
        }));
        if (objectiveRows.length) {
          await insertMany(conn, 'objective_scores',
            ['enrollment_id', 'objective_id', 'test_type', 'questions_answered', 'questions_correct', 'understanding_percentage'],
            objectiveRows, 300);
        }

        for (const notice of notificationRows) {
          const meta = attemptMeta.find((item) => item.enrollment.id === notice.enrollment.id && item.testType === 'certificate_enrolment');
          if (!meta) continue;
          await conn.query(
            `INSERT INTO trainer_mark_release_notifications
              (training_id, enrollment_id, trainee_id, test_attempt_id, certificate_score, is_dismissed)
             VALUES (?, ?, ?, ?, ?, 0)`,
            [trainingId, notice.enrollment.id, notice.enrollment.trainee_id, meta.attemptId, notice.certScore]
          );
          stats.notifications += 1;
        }
      }

      if (ploScoreRows.length) {
        await insertMany(conn, 'practical_learning_outcome_scores',
          ['enrollment_id', 'aspect_id', 'score', 'evaluated_by', 'comments'],
          ploScoreRows, 300);
      }
      if (gradeRows.length) {
        await insertMany(conn, 'final_grades',
          ['enrollment_id', 'training_grade', 'endorsement_grade', 'objective_understanding_percentage', 'hands_on_grade'],
          gradeRows, 200);
      }
      if (certificateRows.length) {
        await insertMany(conn, 'certificate_issues',
          ['enrollment_id', 'training_id', 'trainee_id', 'healthcare_id_at_issue', 'certificate_number',
            'issued_at', 'validity_start', 'validity_end', 'participant_name', 'course_name', 'location', 'date_display'],
          certificateRows, 150);
        stats.certificates += certificateRows.length;
      }
      if (overrideRows.length) {
        await insertMany(conn, 'certificate_release_overrides',
          ['enrollment_id', 'training_id', 'trainee_id', 'certificate_enrolment_score', 'justification', 'released_by', 'released_at'],
          overrideRows);
        stats.overrides += overrideRows.length;
      }
      if (accessRows.length) {
        await insertMany(conn, 'training_material_access',
          ['material_id', 'enrollment_id', 'access_count'],
          accessRows, 300);
      }
      if (downloadUpdates.length) {
        const placeholders = downloadUpdates.map(() => '?').join(',');
        await conn.query(
          `UPDATE enrollments SET can_download_results = 1, status = IF(status = 'dropped', status, 'completed')
           WHERE id IN (${placeholders})`,
          downloadUpdates
        );
      }

      if ((t + 1) % 8 === 0 || t === counts.trainings - 1) {
        console.log(`  ${t + 1}/${counts.trainings} trainings  |  enrollments ${stats.enrollments}  |  answers ${stats.answers}`);
      }
      await conn.commit();
    }

    console.log('Updating trainee training dates and hospital reminders...');
    await conn.query(`
      UPDATE trainees tr
      LEFT JOIN (
        SELECT e.trainee_id,
          MIN(DATE(t.start_datetime)) AS first_training,
          MAX(DATE(t.end_datetime)) AS latest_training,
          SUM(e.status = 'completed') AS completed_count,
          MAX(ci.validity_end) AS recertification_date
        FROM enrollments e
        JOIN trainings t ON t.id = e.training_id
        LEFT JOIN certificate_issues ci ON ci.enrollment_id = e.id
        GROUP BY e.trainee_id
      ) x ON x.trainee_id = tr.id
      SET tr.first_training = x.first_training,
          tr.latest_training = x.latest_training,
          tr.number_of_completed_trainings = COALESCE(x.completed_count, 0),
          tr.recertification_date = x.recertification_date
    `);

    await conn.query(`
      UPDATE healthcare h
      LEFT JOIN (
        SELECT healthcare_id_at_issue AS healthcare_id, MIN(validity_end) AS next_due
        FROM certificate_issues
        WHERE healthcare_id_at_issue IS NOT NULL
        GROUP BY healthcare_id_at_issue
      ) x ON x.healthcare_id = h.id
      SET h.training_reminder_due_date = x.next_due
      WHERE x.next_due IS NOT NULL
    `);

    const [[summary]] = await conn.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM trainees) AS trainees,
        (SELECT COUNT(*) FROM healthcare) AS hospitals,
        (SELECT COUNT(*) FROM trainings) AS trainings,
        (SELECT COUNT(*) FROM enrollments) AS enrollments,
        (SELECT COUNT(*) FROM questions) AS questions,
        (SELECT COUNT(*) FROM test_attempts) AS attempts,
        (SELECT COUNT(*) FROM test_answers) AS answers,
        (SELECT COUNT(*) FROM certificate_issues) AS certificates
    `);

    console.log('\nSeed complete.');
    console.log(`Users: ${summary.users}`);
    console.log(`Hospitals: ${summary.hospitals}`);
    console.log(`Trainees: ${summary.trainees}`);
    console.log(`Trainings: ${summary.trainings}`);
    console.log(`Enrollments: ${summary.enrollments}`);
    console.log(`Questions: ${summary.questions}`);
    console.log(`Test attempts: ${summary.attempts}`);
    console.log(`Answers: ${summary.answers}`);
    console.log(`Certificates: ${summary.certificates}`);
    console.log(`Overrides: ${stats.overrides}  |  Pending mark-release notices: ${stats.notifications}`);
    console.log(`\nPassword for newly seeded accounts: ${args.password}`);
    console.log('Admin: admin@lms.com');
    console.log('Trainer: trainer@lms.com');
    console.log('Extra trainers: first.last@quickstopsolution.com');
    console.log(`Some trainees also use @${EMAIL_DOMAIN} (same password).`);
  } catch (error) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error.message || error);
  if (error.sql) console.error(error.sql);
  process.exit(1);
});
