// test-mailer.js
const { sendEmail } = require('./mailer');

async function testEmail() {
  try {
    await sendEmail(
      'mercuryxpc@gmail.com',
      'Test Email',
      'This is a test email',
      '<h1>This is a test email</h1>'
    );
    console.log('Test email sent successfully');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testEmail();