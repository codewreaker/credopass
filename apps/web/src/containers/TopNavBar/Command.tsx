import React, { useCallback } from 'react';
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
} from '@credopass/ui';

import { launchEventForm } from '../EventForm/index';
import { launchSignInForm } from '../SignInModal/index';
import { launchUserForm } from '../UserForm/index';
import type { LauncherState } from '../../stores/store';


import { useNavigate } from '@tanstack/react-router';

// Command Palette Component
const CommandPalette: React.FC<{
    onClose: () => void;
    openLauncher: ({ content, onClose, onOpen }: Omit<LauncherState, "isOpen">) => void;
    width?: number;
}> = ({ onClose, openLauncher, width }) => {

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



    return (
        <Command 
            style={{ width: width ? `${width}px` : '100%', maxWidth: width ? `${width}px` : '48rem' }}
        >
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