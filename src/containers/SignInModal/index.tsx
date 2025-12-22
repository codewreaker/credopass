/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import type { LauncherState } from '../../store.js';
import './style.css';

interface SignInFormProps {
  onClose?: () => void;
}

export const launchSignInForm = (
  args: SignInFormProps = {},
  openLauncher: (args: Omit<LauncherState, "isOpen">) => void
) => {
  openLauncher({
    content: <SignInForm {...args} />,
  });
};

// The actual SignIn form component with all the logic
const SignInForm: React.FC<SignInFormProps> = ({ onClose }) => {
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    onClose?.();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const PasswordToggleButton = (
    <button
      type="button"
      className="password-toggle"
      onClick={() => setShowPassword(!showPassword)}
    >
      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );

  return (
    <div className="signin-modal-content">
      <div className="modal-header">
        <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
        <p>{isSignUp ? 'Sign up to get started' : 'Sign in to your account'}</p>
      </div>

      <div className="modal-body">
        <form className="signin-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <div className="form-group">
              <Label className="form-label">
                <User size={14} />
                Full Name
              </Label>
              <Input
                type="text"
                id="name"
                name="name"
                placeholder="Enter your name"
                value={formData.name}
                onChange={handleChange}
                required={isSignUp}
              />
            </div>
          )}

          <div className="form-group">
            <Label className="form-label">
              <Mail size={14} />
              Email Address
            </Label>
            <Input
              type="email"
              id="email"
              name="email"
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <Label className="form-label">
              <Lock size={14} />
              Password
            </Label>
            <div className="input-wrapper has-right-element">
              <Input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                required
              />
              {PasswordToggleButton}
            </div>
          </div>

          <Button type="submit" variant="default" className="signin-button">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </Button>
        </form>

        <div className="signin-footer">
          <p>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              className="toggle-mode"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
