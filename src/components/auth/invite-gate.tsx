'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useModal } from '@/stores/use-ui-store';
import { useNotifications } from '@/stores/use-ui-store';
import { Key, Users, ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface InviteGateProps {
  onInviteCodeProvided: (inviteCode: string) => void;
}

const InviteGate: React.FC<InviteGateProps> = ({ onInviteCodeProvided }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { openModal } = useModal();
  const { showError } = useNotifications();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteCode.trim()) {
      showError('Please enter an invite code');
      return;
    }

    setIsLoading(true);

    try {
      // Store the invite code and proceed to signup
      console.log('🎫 Setting invite code and opening signup modal');
      onInviteCodeProvided(inviteCode.trim());

      // Open the auth modal with signup tab after setting invite code
      setTimeout(() => {
        openModal('auth', { defaultTab: 'signup' });
      }, 100); // Small delay to ensure invite code is set
    } catch (error) {
      showError('Invalid invite code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = () => {
    console.log('🎫 Opening auth modal for sign-in');
    openModal('auth', { defaultTab: 'signin' });
  };

  const stage = process.env.NEXT_PUBLIC_STAGE;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent-to/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-accent-gradient rounded-full">
              <Image
                src="/6.png"
                alt="KOL Play Logo"
                width={32}
                height={32}
                className="h-8 w-8"
              />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              KOL Play {stage?.charAt(0).toUpperCase()}
              {stage?.slice(1)}
            </h1>
            <p className="text-muted-foreground mt-2">
              This app is currently in {stage} testing. An invite code is
              required to join.
            </p>
          </div>
        </div>

        {/* Invite Code Form */}
        <Card>
          <CardHeader className="text-center pb-4">
            <CardTitle className="flex items-center justify-center gap-2 text-xl">
              <Key className="h-5 w-5" />
              Enter Invite Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="Enter your invite code"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  className="text-center text-lg tracking-wider"
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !inviteCode.trim()}
                variant="gradient"
              >
                {isLoading ? (
                  'Verifying...'
                ) : (
                  <>
                    Continue to Sign Up
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sign In Option */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Already have an account?
              </p>
              <Button
                variant="outline"
                onClick={handleSignIn}
                className="w-full"
              >
                <Users className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>
            Need an invite code? Contact our team or check our community
            channels.
          </p>
        </div>
      </div>
    </div>
  );
};

export default InviteGate;
