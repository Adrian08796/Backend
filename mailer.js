const nodemailer = require('nodemailer');

// Create a transporter object using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Email options
const mailOptions = {
  from: process.env.EMAIL_USER,
  to: 'mercuryxpc@gmail.com',
  subject: '👋 Hello from Node.js 🚀',
  text: 'This is a test email sent from Node.js using nodemailer. 📧💻'
};

// Send the email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ Error:', error.message);
  } else {
    console.log('✅ Email sent:', info.response);
  }
});