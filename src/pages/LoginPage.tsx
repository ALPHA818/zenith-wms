import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Warehouse, LogIn } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster, toast } from 'sonner';
export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  useEffect(() => {
    // Pre-fill with admin credentials for demo purposes
    setName('Admin User');
    setPassword('password123');
  }, []);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await login({ name, password, rememberMe });
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoggingIn(false);
    }
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative">
      <ThemeToggle className="absolute top-4 right-4" />
      <div className="absolute inset-0 bg-grid-slate-100/[0.05] bg-[bottom_1px_center] dark:bg-grid-slate-400/[0.05] dark:bg-bottom mask-gradient" />
      <div className="z-10 flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-6">
          <img src="/logo.svg" alt="Zenith WMS Logo" className="h-16 w-16" />
          <h1 className="text-4xl font-bold tracking-tight">Zenith Food WMS</h1>
        </div>
        <p className="text-muted-foreground mb-8 max-w-md">
          The central hub for managing your food warehouse operations with speed and precision.
        </p>
        <Card className="w-full max-w-sm shadow-lg animate-fade-in">
          <form onSubmit={handleLogin}>
            <CardHeader>
              <CardTitle className="text-2xl">Welcome Back</CardTitle>
              <CardDescription>Enter your credentials to sign in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="e.g. Admin User"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2 text-left">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                />
                <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
                  Remember me
                </Label>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? 'Signing In...' : 'Sign In'}
                <LogIn className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </form>
        </Card>
        <footer className="mt-12 text-sm text-muted-foreground">
          Built with ❤️ at Cloudflare
        </footer>
      </div>
      <Toaster richColors />
    </div>
  );
}
// Simple gradient mask for the background
const styles = `
.mask-gradient {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 80%, transparent 100%);
}
`;
const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);