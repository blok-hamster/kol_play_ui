'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';
import AuthService from '@/services/auth.service';
import { SUCCESS_MESSAGES } from '@/lib/constants';

interface SignUpFormProps {
  onSuccess?: () => void;
  onRedirectToLogin?: () => void;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

interface OTPFormData {
  otp: string;
}

const SignUpForm: React.FC<SignUpFormProps> = ({
  onSuccess,
  onRedirectToLogin,
}) => {
  const [step, setStep] = useState<'signup' | 'otp'>('signup');
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [otpData, setOtpData] = useState<OTPFormData>({ otp: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingOTP, setIsResendingOTP] = useState(false);

  const { signUp } = useUserStore(); // Removed verifyOTP from here
  const { showSuccess, showError, showInfo } = useNotifications();

  const validateSignUpForm = (): boolean => {
    const newErrors: FormErrors = {};

    // First name validation
    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    // Last name validation
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters long';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password =
        'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateOTPForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!otpData.otp.trim()) {
      newErrors.general = 'Please enter the OTP code';
    } else if (otpData.otp.length !== 6) {
      newErrors.general = 'OTP must be 6 digits';
    } else if (!/^\d{6}$/.test(otpData.otp)) {
      newErrors.general = 'OTP must contain only numbers';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange =
    (field: keyof FormData) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFormData(prev => ({ ...prev, [field]: value }));

      // Clear field error when user starts typing
      if (errors[field]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }

      // Clear general error
      if (errors.general) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.general;
          return newErrors;
        });
      }
    };

  const handleOTPChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/\D/g, '').slice(0, 6); // Only allow digits, max 6
    setOtpData({ otp: value });

    // Clear general error
    if (errors.general) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.general;
        return newErrors;
      });
    }
  };

  const handleSignUpSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateSignUpForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      await signUp({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });

      setStep('otp');
      showInfo(
        'Verify Your Email',
        "We've sent a 6-digit code to your email address. Please check your inbox."
      );
    } catch (error: any) {
      setErrors({ general: error.message });
      showError('Sign Up Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOTPSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateOTPForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      // Verify OTP without auto-login - just verify the email
      await AuthService.verifyOTP({ email: formData.email, otp: otpData.otp });

      showSuccess(
        'Email Verified!',
        'Your account has been created successfully. Please sign in to continue.'
      );

      // Redirect to login instead of auto-logging in
      setTimeout(() => {
        onRedirectToLogin?.();
      }, 1500);
    } catch (error: any) {
      setErrors({ general: error.message });
      showError('Verification Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOTP = async () => {
    setIsResendingOTP(true);
    setErrors({});

    try {
      await AuthService.resendOTP(formData.email);
      showSuccess(
        'OTP Resent',
        'A new verification code has been sent to your email.'
      );
    } catch (error: any) {
      showError('Resend Failed', error.message);
    } finally {
      setIsResendingOTP(false);
    }
  };

  const handleBackToSignUp = () => {
    setStep('signup');
    setOtpData({ otp: '' });
    setErrors({});
  };

  if (step === 'otp') {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">
            Verify Your Email
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            We sent a 6-digit code to <strong>{formData.email}</strong>
          </p>
        </div>

        <form onSubmit={handleOTPSubmit} className="space-y-4">
          {/* General Error */}
          {errors.general && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.general}
              </p>
            </div>
          )}

          {/* OTP Input */}
          <Input
            type="text"
            label="Verification Code"
            placeholder="Enter 6-digit code"
            value={otpData.otp}
            onChange={handleOTPChange}
            className="text-center text-lg tracking-widest"
            maxLength={6}
            required
            autoComplete="one-time-code"
          />

          {/* Resend OTP */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={handleResendOTP}
                className="text-primary hover:underline focus:outline-none focus:underline"
                disabled={isResendingOTP || isSubmitting}
              >
                {isResendingOTP ? 'Sending...' : 'Resend'}
              </button>
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            className="w-full text-white"
            loading={isSubmitting}
            disabled={isSubmitting || isResendingOTP}
          >
            {isSubmitting ? 'Verifying...' : 'Verify Email'}
          </Button>

          {/* Back to Sign Up */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={handleBackToSignUp}
            disabled={isSubmitting || isResendingOTP}
          >
            ← Back to Sign Up
          </Button>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleSignUpSubmit} className="space-y-4">
      {/* General Error */}
      {errors.general && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.general}
          </p>
        </div>
      )}

      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          type="text"
          label="First Name"
          placeholder="First name"
          value={formData.firstName}
          onChange={handleInputChange('firstName')}
          error={errors.firstName}
          required
          autoComplete="given-name"
        />
        <Input
          type="text"
          label="Last Name"
          placeholder="Last name"
          value={formData.lastName}
          onChange={handleInputChange('lastName')}
          error={errors.lastName}
          required
          autoComplete="family-name"
        />
      </div>

      {/* Email Input */}
      <Input
        type="email"
        label="Email"
        placeholder="Enter your email"
        value={formData.email}
        onChange={handleInputChange('email')}
        error={errors.email}
        required
        autoComplete="email"
      />

      {/* Password Input */}
      <Input
        type="password"
        label="Password"
        placeholder="Create a password"
        value={formData.password}
        onChange={handleInputChange('password')}
        error={errors.password}
        helperText="Must be at least 8 characters with uppercase, lowercase, and number"
        required
        autoComplete="new-password"
      />

      {/* Confirm Password Input */}
      <Input
        type="password"
        label="Confirm Password"
        placeholder="Confirm your password"
        value={formData.confirmPassword}
        onChange={handleInputChange('confirmPassword')}
        error={errors.confirmPassword}
        required
        autoComplete="new-password"
      />

      {/* Submit Button */}
      <Button
        type="submit"
        variant="gradient"
        size="lg"
        className="w-full text-white"
        loading={isSubmitting}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Creating Account...' : 'Create Account'}
      </Button>
    </form>
  );
};

export default SignUpForm;
