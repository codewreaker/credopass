import React from 'react';
import { CheckCircle2, Users, Calendar, Sparkles } from 'lucide-react';
import type { User } from '@credopass/lib/schemas';
import { Card, CardContent, Badge } from '@credopass/ui';
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
    <div className="success-screen fixed inset-0 bg-linear-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-950 dark:via-green-950 dark:to-teal-950 flex flex-col items-center justify-center p-6 z-50">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-emerald-200/30 dark:bg-emerald-800/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-green-200/30 dark:bg-green-800/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-teal-200/20 dark:bg-teal-800/10 rounded-full blur-2xl" />
      </div>

      {/* Counter badge - top right */}
      <div className="absolute top-6 right-6 bg-white dark:bg-gray-900 rounded-2xl shadow-xl px-6 py-4 flex items-center gap-4 border border-emerald-100 dark:border-emerald-900">
        <div className="bg-emerald-100 dark:bg-emerald-900 p-2 rounded-xl">
          <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Total Check-ins</p>
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{checkInCount}</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center gap-8 text-center relative z-10">
        {/* Success icon with animation */}
        <div className="success-icon-container relative">
          <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-2xl animate-pulse scale-150" />
          <div className="relative bg-emerald-100 dark:bg-emerald-900 p-6 rounded-full">
            <CheckCircle2 className="w-20 h-20 text-emerald-600 dark:text-emerald-400" />
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-yellow-500 animate-bounce" />
        </div>

        {/* Welcome message */}
        <div className="space-y-3">
          <h1 className="text-5xl font-bold text-emerald-900 dark:text-emerald-100 tracking-tight">
            Welcome!
          </h1>
          <p className="text-xl text-emerald-700 dark:text-emerald-300">
            Successfully checked in
          </p>
        </div>

        {/* User details card */}
        <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-emerald-100 dark:border-emerald-900 shadow-2xl max-w-md w-full">
          <CardContent className="p-8 space-y-6">
            {/* Attendee info */}
            <div className="text-center space-y-2">
              <Badge variant="outline" className="mb-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                Attendee
              </Badge>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-muted-foreground">{user.email}</p>
            </div>

            <div className="h-px bg-linear-to-r from-transparent via-emerald-200 dark:via-emerald-800 to-transparent" />

            {/* Event info */}
            <div className="flex items-center justify-center gap-3">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Event</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">{eventName}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Redirect indicator */}
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <p className="text-sm font-medium">
            Returning to check-in screen...
          </p>
        </div>
      </div>
    </div>
  );
};

export default SuccessCheckInScreen;
