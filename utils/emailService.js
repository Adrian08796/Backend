// utils/emailService.js

// utils/emailService.js

const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const Handlebars = require('handlebars');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Welcome email template
const welcomeEmailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Level Up!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h1 style="color: #1F2937; margin-bottom: 20px;">Welcome to Level Up!</h1>
    <p style="margin-bottom: 20px;">Hi {{username}},</p>
    <p>Thank you for joining Level Up! We're excited to help you achieve your fitness goals.</p>
    <p>You can now access your account and start your fitness journey.</p>
    <div style="margin-top: 30px;">
      <a href="{{loginUrl}}" 
         style="background-color: #45FFCA; 
                color: #1F2937; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;">
        Get Started
      </a>
    </div>
  </div>
</body>
</html>
`;

const generateVerificationToken = (userId, email) => {
  const token = jwt.sign(
    { 
      userId,
      email,
      type: 'email-verification'
    },
    process.env.EMAIL_VERIFICATION_SECRET,
    { expiresIn: '24h' }
  );
  console.log('Generated verification token:', token);
  return token;
};

const sendVerificationEmail = async (email, token) => {
  try {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
    console.log('Sending verification email to:', email);
    console.log('Verification URL:', verificationUrl);

    const info = await transporter.sendMail({
      from: `"Level Up" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Level Up',
      html: `
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `,
      text: `Please verify your email by visiting: ${verificationUrl}\nThis link will expire in 24 hours.`
    });

    console.log('Verification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

const sendWelcomeEmail = async (email, username) => {
  try {
    console.log('Sending welcome email to:', email);
    const template = Handlebars.compile(welcomeEmailTemplate);
    const loginUrl = `${process.env.FRONTEND_URL}/login`;

    const html = template({
      username,
      loginUrl
    });

    const info = await transporter.sendMail({
      from: `"Level Up" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Level Up!',
      html,
      text: `Welcome to Level Up, ${username}! You can now log in at: ${loginUrl}`
    });

    console.log('Welcome email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  generateVerificationToken
};