const bcrypt = require('bcryptjs');
const db = require('./utils/db');

async function resetPasswords() {
  try {
    const [users] = await db.query('SELECT id, email FROM users');
    console.log(`Found ${users.length} users. Resetting passwords...`);

    for (let user of users) {
      // For testing, setting password to 'password123'
      const hashedPassword = await bcrypt.hash('password123', 10);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
      console.log(`Reset password for user: ${user.email}`);
    }

    console.log('All passwords reset successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting passwords:', error);
    process.exit(1);
  }
}

resetPasswords();
