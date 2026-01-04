import React, { useCallback, useEffect } from 'react';
import {
    Calendar,
    User,
    Settings,
    UserPlus,
    LayoutDashboard,
    Users,
    ChartNoAxesCombined,
    Database,
    LogIn
} from 'lucide-react';

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command.js';

import { launchEventForm } from '../EventForm';
import { launchSignInForm } from '../SignInModal';
import { launchUserForm } from '../UserForm';
import type { LauncherState } from '@/store';


import { useNavigate } from '@tanstack/react-router';

// Command Palette Component
const CommandPalette: React.FC<{
    onClose: () => void;
    openLauncher: ({ content, onClose, onOpen }: Omit<LauncherState, "isOpen">) => void;
}> = ({ onClose, openLauncher }) => {

    const navigate = useNavigate();
    const handleNewEvent = useCallback(() => {
        onClose();
        launchEventForm({ isEditing: false }, openLauncher);
    }, [onClose, openLauncher]);

    const handleNewMember = useCallback(() => {
        onClose();
        launchUserForm({ isEditing: false }, openLauncher);
    }, [onClose, openLauncher]);

    const handleSignIn = useCallback(() => {
        onClose();
        launchSignInForm({}, openLauncher);
    }, [onClose, openLauncher]);

    const handleNavigate = useCallback((path: string) => {
        onClose();
        navigate({ to: path });
    }, [onClose, navigate]);

    // Keyboard shortcuts
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            // Direct shortcuts (only when no modals are open)
            if ((e.metaKey || e.ctrlKey)) {
                switch (e.key) {
                    case 'e':
                        e.preventDefault();
                        launchEventForm({ isEditing: false }, openLauncher);
                        break;
                    case 'n':
                        e.preventDefault();
                        launchUserForm({ isEditing: false }, openLauncher);
                        break;
                    case 'h':
                        e.preventDefault();
                        navigate({ to: '/' });
                        break;
                    case 'm':
                        e.preventDefault();
                        navigate({ to: '/members' });
                        break;
                    case 'v':
                        e.preventDefault();
                        navigate({ to: '/events' });
                        break;
                    case 'a':
                        e.preventDefault();
                        navigate({ to: '/analytics' });
                        break;
                    case 't':
                        e.preventDefault();
                        navigate({ to: '/database' });
                        break;
                    case 'p':
                        e.preventDefault();
                        launchSignInForm({}, openLauncher);
                        break;
                }
            }
        };

        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [openLauncher, navigate]);

    return (
        <Command className="rounded-lg border shadow-md w-full max-w-2xl">
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="Quick Actions">
                    <CommandItem onSelect={handleNewEvent}>
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>New Event</span>
                        <CommandShortcut>⌘E</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={handleNewMember}>
                        <UserPlus className="mr-2 h-4 w-4" />
                        <span>Register New Member</span>
                        <CommandShortcut>⌘N</CommandShortcut>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Navigation">
                    <CommandItem onSelect={() => handleNavigate('/')}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>Home</span>
                        <CommandShortcut>⌘H</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => handleNavigate('/members')}>
                        <Users className="mr-2 h-4 w-4" />
                        <span>Members</span>
                        <CommandShortcut>⌘M</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => handleNavigate('/events')}>
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>Events</span>
                        <CommandShortcut>⌘V</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => handleNavigate('/analytics')}>
                        <ChartNoAxesCombined className="mr-2 h-4 w-4" />
                        <span>Analytics</span>
                        <CommandShortcut>⌘A</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => handleNavigate('/database')}>
                        <Database className="mr-2 h-4 w-4" />
                        <span>Tables</span>
                        <CommandShortcut>⌘T</CommandShortcut>
                    </CommandItem>
                </CommandGroup>

                <CommandSeparator />

                <CommandGroup heading="Account">
                    <CommandItem onSelect={handleSignIn}>
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                        <CommandShortcut>⌘P</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={handleSignIn}>
                        <LogIn className="mr-2 h-4 w-4" />
                        <span>Sign In</span>
                    </CommandItem>
                    <CommandItem>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                        <CommandShortcut>⌘S</CommandShortcut>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
        </Command>
    );
};

export default CommandPalette;