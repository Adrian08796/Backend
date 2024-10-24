// utils/emailService.js

const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const Handlebars = require('handlebars');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Email template with proper link construction
const verificationEmailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h1 style="color: #1F2937; margin-bottom: 20px;">Verify Your Email Address</h1>
    <p style="margin-bottom: 20px;">Welcome to Level Up! Please verify your email address to start your fitness journey.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{verificationUrl}}" 
         style="background-color: #45FFCA; 
                color: #1F2937; 
                padding: 12px 24px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;">
        Verify Email
      </a>
    </div>

    <p style="margin-top: 20px;">Or click this link if the button doesn't work:<br>
    <a href="{{verificationUrl}}" style="color: #45FFCA; text-decoration: underline;">{{verificationUrl}}</a></p>
    
    <p style="margin-top: 20px; color: #666;">This verification link will expire in 24 hours.</p>
    <p style="color: #666;">If you didn't create an account with Level Up, please ignore this email.</p>
  </div>
  
  <div style="margin-top: 20px; font-size: 12px; color: #666; text-align: center;">
    <p>This is an automated message, please do not reply.</p>
  </div>
</body>
</html>
`;

const compiledTemplate = Handlebars.compile(verificationEmailTemplate);

const generateVerificationToken = (userId, email) => {
  return jwt.sign(
    { 
      userId, 
      email,
      type: 'email-verification'
    },
    process.env.EMAIL_VERIFICATION_SECRET,
    { expiresIn: '24h' }
  );
};

const sendVerificationEmail = async (email, token) => {
  try {
    // Ensure FRONTEND_URL is properly set and doesn't end with a slash
    const baseUrl = process.env.FRONTEND_URL.replace(/\/$/, '');
    const verificationUrl = `${baseUrl}/verify-email/${token}`;

    const htmlContent = compiledTemplate({
      verificationUrl: verificationUrl
    });

    const mailOptions = {
      from: `"Level Up" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Level Up',
      html: htmlContent,
      text: `Please verify your email by clicking this link: ${verificationUrl}\nThis link will expire in 24 hours.`
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    console.log('Verification URL:', verificationUrl); // For debugging
    return info;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};

const resendVerificationEmail = async (user) => {
  if (!user.email) {
    throw new Error('User email not found');
  }

  const token = generateVerificationToken(user._id, user.email);
  user.emailVerificationToken = token;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  return sendVerificationEmail(user.email, token);
};

module.exports = {
  sendVerificationEmail,
  resendVerificationEmail,
  generateVerificationToken
};