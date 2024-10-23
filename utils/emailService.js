// utils/emailService.js

const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const templatePath = path.join(__dirname, '../templates');


let emailTemplates = {
  verification: null,
  welcome: null
};

// Load email templates
const loadEmailTemplates = async () => {
  try {
    emailTemplates.verification = await fs.readFile(
      path.join(templatePath, 'verificationEmail.html'),
      'utf8'
    );
    emailTemplates.welcome = await fs.readFile(
      path.join(templatePath, 'welcomeEmail.html'),
      'utf8'
    );
  } catch (error) {
    console.error('Error loading email templates:', error);
    // Fallback templates if files can't be loaded
    emailTemplates = {
      verification: `
        <h1>Verify Your Email Address</h1>
        <p>Please click the button below to verify your email address:</p>
        <a href="{{verificationLink}}" style="background-color:#45FFCA;color:#1F2937;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;">
          Verify Email
        </a>
      `,
      welcome: `
        <h1>Welcome to Level Up!</h1>
        <p>Thank you for joining our fitness community.</p>
        <a href="{{guideLink}}" style="background-color:#45FFCA;color:#1F2937;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;">
          View Getting Started Guide
        </a>
      `
    };
  }
};

// Initialize email templates
loadEmailTemplates().then(() => {
  console.log('Email templates loaded successfully');
}).catch(error => {
  console.error('Error loading email templates:', error);
});

// Create transporter with retry logic
const createTransporter = () => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateLimit: 20 // Limit to 20 emails per second
  });

  // Verify transporter configuration
  transporter.verify((error, success) => {
    if (error) {
      console.error('Email transporter verification failed:', error);
    } else {
      console.log('Email transporter ready for messages');
    }
  });

  return transporter;
};

const transporter = createTransporter();

// Generate verification token
const generateVerificationToken = (userId, email) => {
  return jwt.sign(
    { 
      userId, 
      email,
      type: 'email-verification'
    },
    process.env.EMAIL_VERIFICATION_SECRET,
    { 
      expiresIn: '24h',
      algorithm: 'HS256'
    }
  );
};

// Send email with retry logic
const sendEmail = async (options, retries = 3) => {
  try {
    const info = await transporter.sendMail(options);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error(`Error sending email (${retries} retries left):`, error);
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return sendEmail(options, retries - 1);
    }
    throw error;
  }
};

// Send verification email
const sendVerificationEmail = async (email, token) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  const template = emailTemplates.verification.replace('{{verificationLink}}', verificationLink);

  const mailOptions = {
    from: `"Level Up" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your Email - Level Up',
    html: template,
    text: `Please verify your email by clicking this link: ${verificationLink}`,
    headers: {
      'X-Priority': '1',
      'X-MSMail-Priority': 'High'
    }
  };

  return sendEmail(mailOptions);
};

// Send welcome email
const sendWelcomeEmail = async (email, username) => {
  const guideLink = `${process.env.FRONTEND_URL}/guide`;
  const template = emailTemplates.welcome
    .replace('{{username}}', username)
    .replace('{{guideLink}}', guideLink);

  const mailOptions = {
    from: `"Level Up" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to Level Up!',
    html: template,
    text: `Welcome to Level Up, ${username}! Check out our getting started guide: ${guideLink}`,
  };

  return sendEmail(mailOptions);
};

// Resend verification email
const resendVerificationEmail = async (user) => {
  if (!user.email) {
    throw new Error('User email not found');
  }

  // Generate new verification token
  const token = generateVerificationToken(user._id, user.email);
  
  // Update user's verification token
  user.emailVerificationToken = token;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  // Send new verification email
  return sendVerificationEmail(user.email, token);
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  generateVerificationToken,
  resendVerificationEmail
};