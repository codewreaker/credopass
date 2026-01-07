import React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@dwellpass/ui"
import {
    SidebarMenuButton
} from "@dwellpass/ui"

import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem,
    DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger,
    DropdownMenuPortal, DropdownMenuSubContent, DropdownMenuSeparator,
    DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem
} from "@dwellpass/ui"

import {
    FileIcon, FolderIcon, FolderOpenIcon, FileCodeIcon,
    MoreHorizontalIcon, FolderSearchIcon, SaveIcon, DownloadIcon,
    EyeIcon, LayoutIcon, PaletteIcon, SunIcon, MoonIcon,
    MonitorIcon, UserIcon, CreditCardIcon, SettingsIcon,
    KeyboardIcon, LanguagesIcon, BellIcon, MailIcon, ShieldIcon,
    HelpCircleIcon, FileTextIcon, LogOutIcon, ChevronsUpDownIcon
} from "lucide-react"

import type {SidebarProps} from "@/containers/LeftSidebar/index"


const UserComponent:React.FC<{user: SidebarProps['user']}> = ({user}) => {

      const [notifications, setNotifications] = React.useState({
        email: true,
        sms: false,
        push: true,
      })
      const [theme, setTheme] = React.useState("light")
    
    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                    <Avatar className="h-8 w-8 bg-card border-[1.5px] border-primary rounded-full flex items-center justify-center text-primary">
                        <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} className={""} />
                        <AvatarFallback className="rounded-lg flex items-center gap-1.5 bg-transparent border-0 text-primary p-0 cursor-pointer">{user?.name.slice(0, 2).toLocaleUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{user?.name}</span>
                        <span className="truncate text-xs">{user?.email}</span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>File</DropdownMenuLabel>
                    <DropdownMenuItem>
                        <FileIcon
                        />
                        New File
                        <DropdownMenuShortcut>⌘N</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <FolderIcon
                        />
                        New Folder
                        <DropdownMenuShortcut>⇧⌘N</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <FolderOpenIcon
                            />
                            Open Recent
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Recent Projects</DropdownMenuLabel>
                                    <DropdownMenuItem>
                                        <FileCodeIcon
                                        />
                                        Project Alpha
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <FileCodeIcon
                                        />
                                        Project Beta
                                    </DropdownMenuItem>
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            <MoreHorizontalIcon
                                            />
                                            More Projects
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuSubContent>
                                                <DropdownMenuItem>
                                                    <FileCodeIcon
                                                    />
                                                    Project Gamma
                                                </DropdownMenuItem>
                                                <DropdownMenuItem>
                                                    <FileCodeIcon
                                                    />
                                                    Project Delta
                                                </DropdownMenuItem>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuItem>
                                        <FolderSearchIcon
                                        />
                                        Browse...
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>
                        <SaveIcon
                        />
                        Save
                        <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <DownloadIcon
                        />
                        Export
                        <DropdownMenuShortcut>⇧⌘E</DropdownMenuShortcut>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>View</DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                        checked={notifications.email}
                        onCheckedChange={(checked) =>
                            setNotifications({
                                ...notifications,
                                email: checked === true,
                            })
                        }
                    >
                        <EyeIcon
                        />
                        Show Sidebar
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={notifications.sms}
                        onCheckedChange={(checked) =>
                            setNotifications({
                                ...notifications,
                                sms: checked === true,
                            })
                        }
                    >
                        <LayoutIcon
                        />
                        Show Status Bar
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <PaletteIcon
                            />
                            Theme
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Appearance</DropdownMenuLabel>
                                    <DropdownMenuRadioGroup
                                        value={theme}
                                        onValueChange={setTheme}
                                    >
                                        <DropdownMenuRadioItem value="light">
                                            <SunIcon
                                            />
                                            Light
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="dark">
                                            <MoonIcon
                                            />
                                            Dark
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="system">
                                            <MonitorIcon
                                            />
                                            System
                                        </DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Account</DropdownMenuLabel>
                    <DropdownMenuItem>
                        <UserIcon
                        />
                        Profile
                        <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <CreditCardIcon
                        />
                        Billing
                    </DropdownMenuItem>
                    <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                            <SettingsIcon
                            />
                            Settings
                        </DropdownMenuSubTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuSubContent>
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Preferences</DropdownMenuLabel>
                                    <DropdownMenuItem>
                                        <KeyboardIcon
                                        />
                                        Keyboard Shortcuts
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <LanguagesIcon
                                        />
                                        Language
                                    </DropdownMenuItem>
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>
                                            <BellIcon
                                            />
                                            Notifications
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                            <DropdownMenuSubContent>
                                                <DropdownMenuGroup>
                                                    <DropdownMenuLabel>
                                                        Notification Types
                                                    </DropdownMenuLabel>
                                                    <DropdownMenuCheckboxItem
                                                        checked={notifications.push}
                                                        onCheckedChange={(checked) =>
                                                            setNotifications({
                                                                ...notifications,
                                                                push: checked === true,
                                                            })
                                                        }
                                                    >
                                                        <BellIcon
                                                        />
                                                        Push Notifications
                                                    </DropdownMenuCheckboxItem>
                                                    <DropdownMenuCheckboxItem
                                                        checked={notifications.email}
                                                        onCheckedChange={(checked) =>
                                                            setNotifications({
                                                                ...notifications,
                                                                email: checked === true,
                                                            })
                                                        }
                                                    >
                                                        <MailIcon
                                                        />
                                                        Email Notifications
                                                    </DropdownMenuCheckboxItem>
                                                </DropdownMenuGroup>
                                            </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                    </DropdownMenuSub>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                    <DropdownMenuItem>
                                        <ShieldIcon
                                        />
                                        Privacy & Security
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuPortal>
                    </DropdownMenuSub>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <HelpCircleIcon
                        />
                        Help & Support
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <FileTextIcon
                        />
                        Documentation
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem variant="destructive">
                        <LogOutIcon
                        />
                        Sign Out
                        <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default UserComponent