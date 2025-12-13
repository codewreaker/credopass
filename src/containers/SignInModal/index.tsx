import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAppStore } from '../../store';
import { useModal } from '../../components/Launcher/_useLauncher';
import { Button, Input } from '../../components/ui';
import './style.css';

/**
 * SignInModal container - Bridges old event-based system with new modal system
 * Contains the actual sign-in form logic and UI
 */
export const SignInModal: React.FC = () => {
  const hasAddEvent = useAppStore((state) => state.hasEvent('add'));
  const removeEvent = useAppStore((state) => state.removeEvent);
  // const { openModal } = useModal();

  // useEffect(() => {
  //   // If 'add' event is active, open the signin modal
  //   if (hasAddEvent) {
  //     openModal(<SignInForm />);
  //     removeEvent('add');
  //   }
  // }, [hasAddEvent, openModal, removeEvent]);

  return null;
};

interface SignInFormProps {
  onClose?: () => void;
}

// The actual SignIn form component with all the logic
export const SignInForm: React.FC<SignInFormProps> = ({ onClose }) => {
  const { closeModal } = useModal();
  const handleClose = onClose ?? closeModal;
  
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
    handleClose();
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
            <Input
              label="Full Name"
              type="text"
              id="name"
              name="name"
              placeholder="Enter your name"
              value={formData.name}
              onChange={handleChange}
              required={isSignUp}
              leftIcon={<User size={14} />}
            />
          )}

          <Input
            label="Email Address"
            type="email"
            id="email"
            name="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            required
            leftIcon={<Mail size={14} />}
          />

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            id="password"
            name="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            required
            leftIcon={<Lock size={14} />}
            rightElement={PasswordToggleButton}
          />

          <Button type="submit" variant="primary" className="signin-button">
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
