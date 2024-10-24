// utils/emailService.js

const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

// Template paths
const templatePath = path.join(__dirname, '../templates');
let emailTemplates = {
  verification: null,
  welcome: null
};

// Load and compile templates
const loadEmailTemplates = async () => {
  try {
    const [verificationTemplate, welcomeTemplate, passwordResetTemplate] = await Promise.all([
      fs.readFile(path.join(templatePath, 'verificationEmail.html'), 'utf8'),
      fs.readFile(path.join(templatePath, 'welcomeEmail.html'), 'utf8'),
      fs.readFile(path.join(templatePath, 'passwordResetEmail.html'), 'utf8')
    ]);

    emailTemplates.verification = Handlebars.compile(verificationTemplate);
    emailTemplates.welcome = Handlebars.compile(welcomeTemplate);
    emailTemplates.passwordReset = Handlebars.compile(passwordResetTemplate);

    console.log('Email templates loaded successfully');
  } catch (error) {
    console.error('Error loading email templates:', error);
  }
};

// Initialize templates
loadEmailTemplates().catch(error => {
  console.error('Failed to load email templates:', error);
});

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

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
    if (!emailTemplates.verification) {
      await loadEmailTemplates();
    }

    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
    console.log('Sending verification email to:', email);
    console.log('Verification URL:', verificationUrl);

    // Generate email content using template
    const htmlContent = emailTemplates.verification({
      verificationUrl,
      frontendUrl: process.env.FRONTEND_URL,
      token
    });

    const info = await transporter.sendMail({
      from: `"Level Up" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Level Up',
      html: htmlContent,
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
    if (!emailTemplates.welcome) {
      await loadEmailTemplates();
    }

    console.log('Sending welcome email to:', email);
    const guideLink = `${process.env.FRONTEND_URL}/guide`;

    // Generate email content using template
    const htmlContent = emailTemplates.welcome({
      username,
      guideLink,
      frontendUrl: process.env.FRONTEND_URL
    });

    const info = await transporter.sendMail({
      from: `"Level Up" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to Level Up!',
      html: htmlContent,
      text: `Welcome to Level Up, ${username}! Check out our getting started guide: ${guideLink}`
    });

    console.log('Welcome email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
};

// Add a template reload function for development
const reloadTemplates = async () => {
  try {
    await loadEmailTemplates();
    console.log('Email templates reloaded successfully');
  } catch (error) {
    console.error('Error reloading email templates:', error);
    throw error;
  }
};

// Add new function for password reset
const sendPasswordResetEmail = async (email, token) => {
  try {
    if (!emailTemplates.passwordReset) {
      await loadEmailTemplates();
    }

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    console.log('Sending password reset email to:', email);
    console.log('Reset URL:', resetUrl);

    const htmlContent = emailTemplates.passwordReset({
      resetUrl
    });

    const info = await transporter.sendMail({
      from: `"Level Up" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset Your Password - Level Up',
      html: htmlContent,
      text: `Reset your password by visiting: ${resetUrl}\nThis link will expire in 1 hour.`
    });

    console.log('Password reset email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  generateVerificationToken,
  reloadTemplates,
  sendPasswordResetEmail
};