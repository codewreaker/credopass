/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import {
  UserPlus,
  Mail,
  Phone,
  User as UserIcon,
  Trash2,
  Sparkles
} from 'lucide-react';
import { userCollection } from '../../server/collections/user.js';
import type { UserType } from '../../server/db/schema.js';
import { Button } from '../../components/ui/button.js';
import { Input } from '../../components/ui/input.js';
import { Label } from '../../components/ui/label.js';
import type { LauncherState } from '../../store.js';
import './style.css';

// Modal form data type - exported for type safety
export interface UserFormData {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface UserFormProps {
  initialData?: Partial<UserFormData>;
  isEditing?: boolean;
  onClose?: () => void;
}

const initialFormData: UserFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};

export const launchUserForm = (
  args: UserFormProps = {},
  openLauncher: (args: Omit<LauncherState, "isOpen">) => void
) => {
  openLauncher({
    content: <UserForm {...args} />,
  });
};

// User Form Component
const UserForm = ({ initialData = {}, isEditing = false, onClose }: UserFormProps) => {

  const [formData, setFormData] = useState<UserFormData>({ ...initialFormData, ...initialData });
  const [isMutating, setIsMutating] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsMutating(true);
    const now = new Date();
    const userData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone || null,
    };

    try {
      if (isEditing && formData.id) {
        userCollection?.update(formData.id, (draft) => {
          draft.firstName = userData.firstName;
          draft.lastName = userData.lastName;
          draft.email = userData.email;
          draft.phone = userData.phone;
          draft.updatedAt = now;
        });
      } else {
        userCollection?.insert({
          ...userData,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
        });
      }
      onClose?.();
    } catch (error) {
      console.error('Failed to save user:', error);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    if (formData.id && confirm('Are you sure you want to delete this user?')) {
      setIsMutating(true);
      try {
        userCollection?.delete(formData.id);
        onClose?.();
      } catch (error) {
        console.error('Failed to delete user:', error);
      } finally {
        setIsMutating(false);
      }
    }
  };

  return (
    <div className="user-modal">
      <div className="modal-header">
        <div className="header-icon">
          <UserPlus size={24} />
        </div>
        <div className="header-text">
          <h2>{isEditing ? 'Edit Attendee' : 'Register New Attendee'}</h2>
          <p>{isEditing ? 'Update attendee information' : 'Add a new community member to your events'}</p>
        </div>
      </div>

      <div className="modal-body">
        <form className="user-form" onSubmit={handleSubmit}>
          {/* Welcome Message for New Users */}
          {!isEditing && (
            <div className="welcome-banner">
              <Sparkles size={16} />
              <span>Welcome! Let's get you registered for our community events</span>
            </div>
          )}

          {/* First Name & Last Name */}
          <div className="form-row">
            <div className="form-group">
              <Label className="form-label">
                <UserIcon size={14} />
                First Name
              </Label>
              <Input
                type="text"
                name="firstName"
                placeholder="John"
                value={formData.firstName}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <Label className="form-label">
                <UserIcon size={14} />
                Last Name
              </Label>
              <Input
                type="text"
                name="lastName"
                placeholder="Doe"
                value={formData.lastName}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-field-wrapper">
            <Label className="form-label">
              <Mail size={14} />
              Email Address
            </Label>
            <Input
              type="email"
              name="email"
              placeholder="john.doe@example.com"
              value={formData.email}
              onChange={handleInputChange}
              required
            />
            <p className="field-hint">We'll use this to send you event updates</p>
          </div>

          {/* Phone Number */}
          <div className="form-field-wrapper">
            <Label className="form-label">
              <Phone size={14} />
              Phone Number
            </Label>
            <Input
              type="tel"
              name="phone"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={handleInputChange}
            />
            <p className="field-hint">Optional - For important event notifications</p>
          </div>

          {/* Info Box */}
          {!isEditing && (
            <div className="info-box">
              <div className="info-icon">ℹ️</div>
              <div className="info-text">
                <strong>What happens next?</strong>
                <p>You'll be added to our community and can start attending events immediately. Track your attendance and earn loyalty rewards!</p>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="form-actions">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isMutating}
              >
                <Trash2 size={14} />
                Delete
              </Button>
            )}
            <div className="actions-right">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isMutating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                disabled={isMutating}
              >
                {!isMutating && <UserPlus size={14} />}
                {isMutating ? 'Saving...' : isEditing ? 'Update Attendee' : 'Register Attendee'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;
