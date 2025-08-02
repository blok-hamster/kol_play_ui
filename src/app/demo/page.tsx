'use client';

import React from 'react';
import AppLayout from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';

const DemoPage: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <AppLayout>
      <div className="p-6 space-y-8">
        {/* Theme Test Section */}
        <div className="bg-muted/50 rounded-lg p-6 border-2 border-border">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            🎨 Theme Test Section
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-background border border-border rounded-lg">
              <h3 className="font-semibold text-foreground">Background Test</h3>
              <p className="text-muted-foreground">
                This should change with theme
              </p>
            </div>

            <div className="p-4 bg-card border border-border rounded-lg">
              <h3 className="font-semibold text-card-foreground">Card Test</h3>
              <p className="text-muted-foreground">Card background changes</p>
            </div>

            <div className="p-4 bg-secondary border border-border rounded-lg">
              <h3 className="font-semibold text-secondary-foreground">
                Secondary Test
              </h3>
              <p className="text-muted-foreground">Secondary background</p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-sm">
              <strong>Current Theme:</strong> {theme}
            </p>
            <p className="text-sm">
              <strong>Resolved Theme:</strong> {resolvedTheme}
            </p>
            <p className="text-sm">
              <strong>Document Class:</strong>{' '}
              {typeof window !== 'undefined'
                ? document.documentElement.className
                : 'N/A'}
            </p>
            <p className="text-sm">
              <strong>Background Color:</strong>
              <span className="ml-2 px-2 py-1 bg-background border border-border rounded text-xs">
                var(--background)
              </span>
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setTheme('light')}
              variant="outline"
              size="sm"
            >
              ☀️ Light
            </Button>
            <Button
              onClick={() => setTheme('dark')}
              variant="outline"
              size="sm"
            >
              🌙 Dark
            </Button>
            <Button
              onClick={() => setTheme('system')}
              variant="outline"
              size="sm"
            >
              💻 System
            </Button>
          </div>
        </div>

        {/* Original Demo Content */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              Demo Page
            </h1>
            <p className="text-lg text-muted-foreground">
              This page demonstrates the application layout, theme system, and
              UI components.
            </p>
          </div>

          {/* Theme Toggle Demo */}
          <div className="bg-muted/50 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Theme System
            </h2>
            <p className="text-muted-foreground mb-4">
              Toggle between light, dark, and system themes using the theme
              toggle in the header.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Color Palette
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-16 bg-background border border-border rounded-lg flex items-center justify-center">
                    <span className="text-xs text-foreground">Background</span>
                  </div>
                  <div className="h-16 bg-foreground rounded-lg flex items-center justify-center">
                    <span className="text-xs text-background">Foreground</span>
                  </div>
                  <div className="h-16 bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Muted</span>
                  </div>
                  <div className="h-16 bg-accent-gradient rounded-lg flex items-center justify-center">
                    <span className="text-xs text-white font-semibold">
                      Accent
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Components
                </h3>
                <div className="space-y-2">
                  <Button variant="default">Default Button</Button>
                  <Button variant="outline">Outline Button</Button>
                  <Button variant="gradient" className="text-white">
                    Gradient Button
                  </Button>
                  <Button variant="ghost">Ghost Button</Button>
                </div>
              </div>
            </div>
          </div>

          {/* Layout Demo */}
          <div className="bg-muted/50 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">
              Layout System
            </h2>
            <p className="text-muted-foreground mb-4">
              The layout includes a collapsible sidebar, responsive header, and
              main content area.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Features
                </h3>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Responsive design</li>
                  <li>• Collapsible sidebar</li>
                  <li>• Dark/light theme support</li>
                  <li>• Mobile-friendly navigation</li>
                  <li>• Accessibility features</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Navigation
                </h3>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• KOL Trading</li>
                  <li>• Token Discovery</li>
                  <li>• Portfolio Management</li>
                  <li>• Trading Interface</li>
                  <li>• Settings</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DemoPage;
