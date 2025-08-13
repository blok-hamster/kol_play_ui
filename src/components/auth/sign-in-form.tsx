'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUserStore } from '@/stores/use-user-store';
import { useNotifications } from '@/stores/use-ui-store';
import AuthService from '@/services/auth.service';
import { SUCCESS_MESSAGES } from '@/lib/constants';

interface SignInFormProps {
  onSuccess?: () => void;
  onForgotPassword?: () => void;
}

interface FormData {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

const SignInForm: React.FC<SignInFormProps> = ({
  onSuccess,
  onForgotPassword,
}) => {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn } = useUserStore();
  const { showSuccess, showError, showInfo } = useNotifications();

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      await signIn(formData.email, formData.password);
      
      // Check if user has account details errors after signin
      const { user } = useUserStore.getState();
      if (user?.accountDetails?._hasError) {
        // Show success for signin but info about account details
        showSuccess('Welcome back!', SUCCESS_MESSAGES.LOGIN_SUCCESS);
        showInfo(
          'Account Details Unavailable',
          'Your account details could not be loaded. Use the refresh button in the wallet dropdown to try again.'
        );
      } else {
        showSuccess('Welcome back!', SUCCESS_MESSAGES.LOGIN_SUCCESS);
      }
      
      onSuccess?.();
    } catch (error: any) {
      setErrors({ general: error.message });
      showError('Sign In Failed', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email.trim()) {
      setErrors({ email: 'Please enter your email address first' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    try {
      await AuthService.forgotPassword(formData.email);
      showSuccess(
        'Reset Email Sent',
        'Check your email for password reset instructions.'
      );
      onForgotPassword?.();
    } catch (error: any) {
      showError('Reset Failed', error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* General Error */}
      {errors.general && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.general}
          </p>
        </div>
      )}

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
        placeholder="Enter your password"
        value={formData.password}
        onChange={handleInputChange('password')}
        error={errors.password}
        required
        autoComplete="current-password"
      />

      {/* Forgot Password Link */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-sm text-primary hover:underline focus:outline-none focus:underline"
          disabled={isSubmitting}
        >
          Forgot password?
        </button>
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        variant="gradient"
        size="lg"
        className="w-full text-white"
        loading={isSubmitting}
      >
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
};

export default SignInForm;
