import React from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@credopass/ui/components/avatar"

import {
    SidebarMenuButton
} from "@credopass/ui/components/sidebar"

import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuGroup, DropdownMenuLabel, DropdownMenuItem,
    DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubTrigger,
    DropdownMenuPortal, DropdownMenuSubContent, DropdownMenuSeparator,
    DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem
} from "@credopass/ui/components/dropdown-menu"

import { ChevronsUpDownIcon, type LucideIcon } from "lucide-react"

// ============================================================================
// Menu Configuration Types
// ============================================================================

export type MenuItemType = 
    | 'item' 
    | 'checkbox' 
    | 'radio-group' 
    | 'submenu' 
    | 'separator' 
    | 'label'

export interface BaseMenuItem {
    id: string
    type: MenuItemType
}

export interface MenuItemConfig extends BaseMenuItem {
    type: 'item'
    label: string
    icon?: LucideIcon
    shortcut?: string
    variant?: 'default' | 'destructive'
    disabled?: boolean
    onClick?: () => void
}

export interface MenuCheckboxConfig extends BaseMenuItem {
    type: 'checkbox'
    label: string
    icon?: LucideIcon
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    disabled?: boolean
}

export interface MenuRadioGroupConfig extends BaseMenuItem {
    type: 'radio-group'
    label?: string
    value: string
    onValueChange: (value: string) => void
    options: {
        value: string
        label: string
        icon?: LucideIcon
    }[]
}

export interface MenuSubmenuConfig extends BaseMenuItem {
    type: 'submenu'
    label: string
    icon?: LucideIcon
    items: MenuConfig[]
}

export interface MenuSeparatorConfig extends BaseMenuItem {
    type: 'separator'
}

export interface MenuLabelConfig extends BaseMenuItem {
    type: 'label'
    label: string
}

export type MenuConfig = 
    | MenuItemConfig 
    | MenuCheckboxConfig 
    | MenuRadioGroupConfig 
    | MenuSubmenuConfig 
    | MenuSeparatorConfig 
    | MenuLabelConfig

export interface MenuGroupConfig {
    id: string
    label?: string
    items: MenuConfig[]
}

export interface UserMenuProps {
    user?: {
        name?: string
        email?: string
        avatar?: string
        icon?: LucideIcon
    }
    menuGroups: MenuGroupConfig[]
    contentAlign?: 'start' | 'center' | 'end'
    contentClassName?: string
}

// ============================================================================
// Menu Item Renderers
// ============================================================================

const renderMenuItem = (item: MenuConfig): React.ReactNode => {
    switch (item.type) {
        case 'separator':
            return <DropdownMenuSeparator key={item.id} />
        
        case 'label':
            return <DropdownMenuLabel key={item.id}>{item.label}</DropdownMenuLabel>
        
        case 'item':
            return (
                <DropdownMenuItem 
                    key={item.id} 
                    variant={item.variant}
                    disabled={item.disabled}
                    onClick={item.onClick}
                >
                    {item.icon && <item.icon />}
                    {item.label}
                    {item.shortcut && <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>}
                </DropdownMenuItem>
            )
        
        case 'checkbox':
            return (
                <DropdownMenuCheckboxItem
                    key={item.id}
                    checked={item.checked}
                    onCheckedChange={(checked) => item.onCheckedChange(checked === true)}
                    disabled={item.disabled}
                >
                    {item.icon && <item.icon />}
                    {item.label}
                </DropdownMenuCheckboxItem>
            )
        
        case 'radio-group':
            return (
                <React.Fragment key={item.id}>
                    {item.label && <DropdownMenuLabel>{item.label}</DropdownMenuLabel>}
                    <DropdownMenuRadioGroup value={item.value} onValueChange={item.onValueChange}>
                        {item.options.map((option) => (
                            <DropdownMenuRadioItem key={option.value} value={option.value}>
                                {option.icon && <option.icon />}
                                {option.label}
                            </DropdownMenuRadioItem>
                        ))}
                    </DropdownMenuRadioGroup>
                </React.Fragment>
            )
        
        case 'submenu':
            return (
                <DropdownMenuSub key={item.id}>
                    <DropdownMenuSubTrigger>
                        {item.icon && <item.icon />}
                        {item.label}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                            {item.items.map(renderMenuItem)}
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>
            )
        
        default:
            return null
    }
}

const renderMenuGroup = (group: MenuGroupConfig): React.ReactNode => {
    return (
        <DropdownMenuGroup key={group.id}>
            {group.label && <DropdownMenuLabel>{group.label}</DropdownMenuLabel>}
            {group.items.map(renderMenuItem)}
        </DropdownMenuGroup>
    )
}

// ============================================================================
// User Component a component like a profile with menus similar to profile button
// ============================================================================

const UserComponent: React.FC<UserMenuProps> = ({ 
    user, 
    menuGroups,
    contentAlign = 'end',
    contentClassName = 'w-56'
}) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                    <Avatar className="h-8 w-8 bg-card border-[1.5px] border-primary rounded-full flex items-center justify-center text-primary">
                        <AvatarImage src={user?.avatar || "/placeholder.svg"} alt={user?.name} className={""} />
                        <AvatarFallback className="rounded-lg flex items-center gap-1.5 bg-transparent border-0 text-primary p-0 cursor-pointer">
                            {user?.icon ? <user.icon className="h-5 w-5" /> : user?.name?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{user?.name}</span>
                        <span className="truncate text-xs">{user?.email}</span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={contentAlign} className={contentClassName}>
                {menuGroups.map((group, index) => (
                    <React.Fragment key={group.id}>
                        {index > 0 && <DropdownMenuSeparator />}
                        {renderMenuGroup(group)}
                    </React.Fragment>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export { UserComponent }
export default UserComponent