import React from "react"
import {
    UserIcon, CreditCardIcon, SettingsIcon,
    HelpCircleIcon, FileTextIcon, LogOutIcon,
    SunIcon, MoonIcon, PaletteIcon,
    BellIcon
} from "lucide-react"
import { useTheme } from "@credopass/lib/theme"
import type { MenuGroupConfig } from "./index"

// ============================================================================
// Default User Menu Configuration
// ============================================================================

interface UseDefaultUserMenuOptions {
    onSignOut?: () => void
    onNavigateToProfile?: () => void
    onNavigateToBilling?: () => void
    onNavigateToSettings?: () => void
    onNavigateToHelp?: () => void
    onNavigateToDocs?: () => void
}

export const useDefaultUserMenu = (options: UseDefaultUserMenuOptions = {}): MenuGroupConfig[] => {
    const { theme, setTheme } = useTheme()
    const [notifications, setNotifications] = React.useState({
        push: true,
        email: true,
    })

    const menuGroups: MenuGroupConfig[] = [
        {
            id: 'account',
            label: 'Account',
            items: [
                {
                    id: 'profile',
                    type: 'item',
                    label: 'Profile',
                    icon: UserIcon,
                    shortcut: '⇧⌘P',
                    onClick: options.onNavigateToProfile,
                },
                {
                    id: 'billing',
                    type: 'item',
                    label: 'Billing',
                    icon: CreditCardIcon,
                    onClick: options.onNavigateToBilling,
                },
                {
                    id: 'theme',
                    type: 'submenu',
                    label: 'Theme',
                    icon: PaletteIcon,
                    items: [
                        {
                            id: 'theme-options',
                            type: 'radio-group',
                            label: 'Appearance',
                            value: theme,
                            onValueChange: (value) => setTheme(value as 'light' | 'dark'),
                            options: [
                                { value: 'light', label: 'Light', icon: SunIcon },
                                { value: 'dark', label: 'Dark', icon: MoonIcon },
                            ],
                        },
                    ],
                },
                {
                    id: 'settings',
                    type: 'submenu',
                    label: 'Settings',
                    icon: SettingsIcon,
                    items: [
                        {
                            id: 'notifications',
                            type: 'submenu',
                            label: 'Notifications',
                            icon: BellIcon,
                            items: [
                                { id: 'notif-label', type: 'label', label: 'Notification Types' },
                                {
                                    id: 'push-notifications',
                                    type: 'checkbox',
                                    label: 'Push Notifications',
                                    icon: BellIcon,
                                    checked: notifications.push,
                                    onCheckedChange: (checked) => setNotifications(prev => ({ ...prev, push: checked })),
                                },
                                {
                                    id: 'email-notifications',
                                    type: 'checkbox',
                                    label: 'Email Notifications',
                                    icon: BellIcon,
                                    checked: notifications.email,
                                    onCheckedChange: (checked) => setNotifications(prev => ({ ...prev, email: checked })),
                                },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            id: 'support',
            items: [
                {
                    id: 'help',
                    type: 'item',
                    label: 'Help & Support',
                    icon: HelpCircleIcon,
                    onClick: options.onNavigateToHelp,
                },
                {
                    id: 'docs',
                    type: 'item',
                    label: 'Documentation',
                    icon: FileTextIcon,
                    onClick: options.onNavigateToDocs,
                },
            ],
        },
        {
            id: 'signout',
            items: [
                {
                    id: 'signout-btn',
                    type: 'item',
                    label: 'Sign Out',
                    icon: LogOutIcon,
                    shortcut: '⇧⌘Q',
                    variant: 'destructive',
                    onClick: options.onSignOut,
                },
            ],
        },
    ]

    return menuGroups
}

export default useDefaultUserMenu
