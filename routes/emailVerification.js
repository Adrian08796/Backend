// src/components/EmailVerification.jsx

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGymContext } from '../context/GymContext';
import axiosInstance from '../utils/axiosConfig';

function EmailVerification() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { showToast } = useGymContext();
  const [verificationStatus, setVerificationStatus] = useState('verifying');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await axiosInstance.get(`/api/auth/verify-email/${token}`);
        console.log('Verification response:', response);
        setVerificationStatus('success');
        showToast('success', 'Success', 'Email verified successfully! You can now log in.');
        setTimeout(() => navigate('/login'), 3000);
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationStatus('error');
        let errorMessage = 'Verification failed';
        if (error.response) {
          errorMessage = error.response.data.message || errorMessage;
        }
        showToast('error', 'Error', errorMessage);
      }
    };

    if (token) {
      verifyEmail();
    }
  }, [token, navigate, showToast]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <h2 className="text-2xl font-bold text-center mb-4">Email Verification</h2>
        
        {verificationStatus === 'verifying' && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
            <p className="mt-4">Verifying your email...</p>
          </div>
        )}

        {verificationStatus === 'success' && (
          <div className="text-center text-green-600">
            <div className="text-5xl mb-4">✓</div>
            <p>Your email has been verified successfully!</p>
            <p className="mt-2">Redirecting to login page...</p>
          </div>
        )}

        {verificationStatus === 'error' && (
          <div className="text-center text-red-600">
            <div className="text-5xl mb-4">✗</div>
            <p>Verification failed. The link may be invalid or expired.</p>
            <button
              onClick={() => navigate('/login')}
              className="mt-4 bg-emerald-500 text-white px-4 py-2 rounded hover:bg-emerald-600"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EmailVerification;