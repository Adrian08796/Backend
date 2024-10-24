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
    const [verificationTemplate, welcomeTemplate] = await Promise.all([
      fs.readFile(path.join(templatePath, 'verificationEmail.html'), 'utf8'),
      fs.readFile(path.join(templatePath, 'welcomeEmail.html'), 'utf8')
    ]);

    // Compile templates with Handlebars
    emailTemplates.verification = Handlebars.compile(verificationTemplate);
    emailTemplates.welcome = Handlebars.compile(welcomeTemplate);

    console.log('Email templates loaded and compiled successfully');
  } catch (error) {
    console.error('Error loading email templates:', error);
    // Fallback templates
    emailTemplates.verification = Handlebars.compile(`
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>Verify Your Email Address</h1>
        <p>Please click the button below to verify your email address:</p>
        <a href="{{verificationLink}}" style="background-color:#45FFCA;color:#1F2937;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;">
          Verify Email
        </a>
      </body>
      </html>
    `);

    emailTemplates.welcome = Handlebars.compile(`
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>Welcome to Level Up!</h1>
        <p>Hi {{username}},</p>
        <p>Thank you for joining our fitness community.</p>
        <a href="{{guideLink}}" style="background-color:#45FFCA;color:#1F2937;padding:12px 24px;text-decoration:none;border-radius:5px;display:inline-block;">
          View Getting Started Guide
        </a>
      </body>
      </html>
    `);
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
    rateLimit: 20
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

// Generate verification token with proper secret
const generateVerificationToken = (userId, email) => {
  try {
    return jwt.sign(
      { 
        userId, 
        email,
        type: 'email-verification',
        timestamp: Date.now() // Add timestamp for additional security
      },
      process.env.EMAIL_VERIFICATION_SECRET,
      { 
        expiresIn: '24h',
        algorithm: 'HS256'
      }
    );
  } catch (error) {
    console.error('Error generating verification token:', error);
    throw error;
  }
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

// Send verification email with proper link construction
const sendVerificationEmail = async (email, token) => {
  try {
    // Ensure proper URL construction
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${token}`;
    
    // Generate email content using template
    const htmlContent = emailTemplates.verification({
      verificationLink,
      appName: 'Level Up',
      supportEmail: process.env.EMAIL_USER,
      expiryHours: 24 // Token expires in 24 hours
    });

    const mailOptions = {
      from: `"Level Up" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify Your Email - Level Up',
      html: htmlContent,
      text: `Please verify your email by clicking this link: ${verificationLink}\nThis link will expire in 24 hours.`,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High'
      }
    };

    // Send email with retry logic
    const result = await sendEmail(mailOptions, 3);
    console.log('Verification email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending verification email:', error);
    throw error;
  }
};


// Send welcome email
const sendWelcomeEmail = async (email, username) => {
  const guideLink = `${process.env.FRONTEND_URL}/guide`;
  
  // Generate email content using template
  const htmlContent = emailTemplates.welcome({
    username,
    guideLink,
    appName: 'Level Up',
    supportEmail: process.env.EMAIL_USER
  });

  const mailOptions = {
    from: `"Level Up" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Welcome to Level Up!',
    html: htmlContent,
    text: `Welcome to Level Up, ${username}! Check out our getting started guide: ${guideLink}`,
  };

  return sendEmail(mailOptions);
};

// Resend verification email
// Resend verification email with proper error handling
const resendVerificationEmail = async (user) => {
  if (!user.email) {
    throw new Error('User email not found');
  }

  try {
    // Generate new verification token
    const token = generateVerificationToken(user._id, user.email);
    
    // Update user's verification token in database
    user.emailVerificationToken = token;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Send new verification email
    return await sendVerificationEmail(user.email, token);
  } catch (error) {
    console.error('Error resending verification email:', error);
    throw error;
  }
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  generateVerificationToken,
  resendVerificationEmail
};