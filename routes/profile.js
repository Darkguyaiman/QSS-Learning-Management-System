const express = require('express');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const router = express.Router();

// Profile picture upload
const storage = multer.diskStorage({
  destination: './public/uploads/profiles/',
  filename: (req, file, cb) => {
    cb(null, req.session.userId + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Helper function to get profile
async function getProfile(db, userRole, userId) {
  if (userRole === 'trainee') {
    const [trainees] = await db.query('SELECT * FROM trainees WHERE id = ?', [userId]);
    return trainees.length > 0 ? trainees[0] : null;
  } else {
    const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    return users.length > 0 ? users[0] : null;
  }
}

// View profile
router.get('/', async (req, res) => {
  try {
    const profile = await getProfile(req.db, req.session.userRole, req.session.userId);
    
    if (!profile) {
      return res.status(404).send('Profile not found');
    }
    
    res.render('profile/view', { user: req.session, profile, error: null, passwordError: null });
  } catch (error) {
    console.error('Profile view error:', error);
    res.status(500).send('Error loading profile');
  }
});

// Update profile
router.post('/update', async (req, res) => {
  const { firstName, lastName, email } = req.body;
  
  try {
    // Validate input
    if (!firstName || !lastName || !email) {
      let profile;
      if (req.session.userRole === 'trainee') {
        const [trainees] = await req.db.query('SELECT * FROM trainees WHERE id = ?', [req.session.userId]);
        profile = trainees[0];
      } else {
        const [users] = await req.db.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        profile = users[0];
      }
      return res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: 'All fields are required',
        passwordError: null
      });
    }
    
    if (req.session.userRole === 'trainee') {
      await req.db.query(
        'UPDATE trainees SET first_name = ?, last_name = ?, email = ? WHERE id = ?',
        [firstName, lastName, email, req.session.userId]
      );
    } else {
      await req.db.query(
        'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?',
        [firstName, lastName, email, req.session.userId]
      );
    }
    
    req.session.userName = `${firstName} ${lastName}`;
    res.redirect('/profile');
  } catch (error) {
    console.error('Profile update error:', error);
    let profile;
    try {
      if (req.session.userRole === 'trainee') {
        const [trainees] = await req.db.query('SELECT * FROM trainees WHERE id = ?', [req.session.userId]);
        profile = trainees[0];
      } else {
        const [users] = await req.db.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        profile = users[0];
      }
      res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: 'Error updating profile. Please try again.',
        passwordError: null
      });
    } catch (renderError) {
      res.status(500).send('Error updating profile');
    }
  }
});

// Upload profile picture
router.post('/upload-picture', upload.single('profilePicture'), async (req, res) => {
  try {
    // Only trainers and admins can upload profile pictures
    if (!['admin', 'trainer'].includes(req.session.userRole)) {
      let profile;
      if (req.session.userRole === 'trainee') {
        const [trainees] = await req.db.query('SELECT * FROM trainees WHERE id = ?', [req.session.userId]);
        profile = trainees[0];
      } else {
        const [users] = await req.db.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        profile = users[0];
      }
      return res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: 'You do not have permission to change profile pictures',
        passwordError: null
      });
    }
    
    if (!req.file) {
      let profile;
      if (req.session.userRole === 'trainee') {
        const [trainees] = await req.db.query('SELECT * FROM trainees WHERE id = ?', [req.session.userId]);
        profile = trainees[0];
      } else {
        const [users] = await req.db.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        profile = users[0];
      }
      return res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: 'No file uploaded',
        passwordError: null
      });
    }
    
    // Check file size (5MB limit)
    if (req.file.size > 5 * 1024 * 1024) {
      let profile;
      if (req.session.userRole === 'trainee') {
        const [trainees] = await req.db.query('SELECT * FROM trainees WHERE id = ?', [req.session.userId]);
        profile = trainees[0];
      } else {
        const [users] = await req.db.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        profile = users[0];
      }
      return res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: 'File size exceeds 5MB limit',
        passwordError: null
      });
    }
    
    const profilePath = `/uploads/profiles/${req.file.filename}`;
    
    if (req.session.userRole === 'trainee') {
      await req.db.query(
        'UPDATE trainees SET profile_picture = ? WHERE id = ?',
        [profilePath, req.session.userId]
      );
    } else {
      await req.db.query(
        'UPDATE users SET profile_picture = ? WHERE id = ?',
        [profilePath, req.session.userId]
      );
    }
    
    req.session.userProfile = profilePath;
    res.redirect('/profile');
  } catch (error) {
    console.error('Profile picture upload error:', error);
    let profile;
    try {
      if (req.session.userRole === 'trainee') {
        const [trainees] = await req.db.query('SELECT * FROM trainees WHERE id = ?', [req.session.userId]);
        profile = trainees[0];
      } else {
        const [users] = await req.db.query('SELECT * FROM users WHERE id = ?', [req.session.userId]);
        profile = users[0];
      }
      res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: 'Error uploading picture. Please try again.',
        passwordError: null
      });
    } catch (renderError) {
      res.status(500).send('Error uploading picture');
    }
  }
});

// Change password
router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  
  try {
    // Get current profile
    const profile = await getProfile(req.db, req.session.userRole, req.session.userId);
    
    if (!profile) {
      return res.status(404).send('Profile not found');
    }
    
    // Validate input
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: null,
        passwordError: 'All password fields are required' 
      });
    }
    
    // Validate new password length
    if (newPassword.length < 6) {
      return res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: null,
        passwordError: 'New password must be at least 6 characters long' 
      });
    }
    
    // Validate password match
    if (newPassword !== confirmPassword) {
      return res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: null,
        passwordError: 'New password and confirm password do not match' 
      });
    }
    
    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, profile.password);
    if (!validPassword) {
      return res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: null,
        passwordError: 'Current password is incorrect' 
      });
    }
    
    // Check if new password is different from current
    const samePassword = await bcrypt.compare(newPassword, profile.password);
    if (samePassword) {
      return res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: null,
        passwordError: 'New password must be different from current password' 
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    if (req.session.userRole === 'trainee') {
      await req.db.query(
        'UPDATE trainees SET password = ? WHERE id = ?',
        [hashedPassword, req.session.userId]
      );
    } else {
      await req.db.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, req.session.userId]
      );
    }
    
    // Get updated profile
    const updatedProfile = await getProfile(req.db, req.session.userRole, req.session.userId);
    
    res.render('profile/view', { 
      user: req.session, 
      profile: updatedProfile, 
      error: null,
      passwordError: null,
      passwordSuccess: 'Password changed successfully!' 
    });
  } catch (error) {
    console.error('Password change error:', error);
    let profile;
    try {
      profile = await getProfile(req.db, req.session.userRole, req.session.userId);
      res.render('profile/view', { 
        user: req.session, 
        profile, 
        error: null,
        passwordError: 'Error changing password. Please try again.' 
      });
    } catch (renderError) {
      res.status(500).send('Error changing password');
    }
  }
});

module.exports = router;
