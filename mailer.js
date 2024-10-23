// mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter with authentication
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',  // Or your SMTP host
  port: 587,              // Common SMTP port
  secure: false,          // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false // Only use this in development
  }
});

// Function to send email
async function sendEmail(to, subject, text, html) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = { sendEmail };