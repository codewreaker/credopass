import React from 'react';
import { CheckCircle2, Users } from 'lucide-react';
import type { User } from '@credopass/lib/schemas';
import './style.css';

interface SuccessCheckInScreenProps {
  user: Partial<User>;
  checkInCount: number;
  eventName: string;
}

const SuccessCheckInScreen: React.FC<SuccessCheckInScreenProps> = ({
  user,
  checkInCount,
  eventName,
}) => {
  return (
    <div className="success-screen fixed inset-0 bg-linear-to-br from-green-50 to-emerald-50 flex flex-col items-center justify-center p-6 z-50">
      <div className="absolute top-6 right-6 bg-white rounded-lg shadow-lg px-6 py-3 flex items-center gap-3">
        <Users className="w-5 h-5 text-emerald-600" />
        <div>
          <p className="text-xs font-medium text-muted-foreground">Total Check-ins</p>
          <p className="text-2xl font-bold text-emerald-600">{checkInCount}</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 text-center">
        <div className="success-icon-container">
          <CheckCircle2 className="w-24 h-24 text-emerald-600 animate-bounce" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-emerald-900">Welcome!</h1>
          <p className="text-lg text-emerald-700">Successfully checked in</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 max-w-sm w-full space-y-3">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Attendee</p>
            <p className="text-2xl font-bold text-gray-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{user.email}</p>
          </div>

          <hr className="my-4" />

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Event</p>
            <p className="text-lg font-semibold text-gray-900">{eventName}</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground animate-pulse">
          Redirecting in a moment...
        </p>
      </div>
    </div>
  );
};

export default SuccessCheckInScreen;
