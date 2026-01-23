import { ArrowUpRightIcon, UserPlus } from "lucide-react"

import { Button } from "@credopass/ui/components/button"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@credopass/ui/components/empty"

const EmptyState: React.FC<{
    title?: string;
    description?: string;
    action?: {
        label: string;
        icon?: React.ReactElement;
        onClick: () => void;
    };
    secondaryAction?: {
        label: string;
        onClick: () => void;
    };
    error?: boolean;
    link?: { label: string; url: string };
    icon?: React.ReactElement;
}> = ({
    title = "No Projects Found",
    description = "You haven&apos;t created any projects yet. Get started by creating your first project.",
    action = { label: "Create Project", onClick: () => { } },
    secondaryAction,
    link,
    icon = <UserPlus />,
    error = false,
}) => {
        return (
            <Empty className="position-absolute z-50">
                <EmptyHeader>
                    <EmptyMedia variant={icon ? 'default' : 'icon'}>
                        {icon}
                    </EmptyMedia>
                    <EmptyTitle className={error ? "text-2xl text-destructive" : "text-2xl"}>{title}</EmptyTitle>
                    <EmptyDescription className={error ? "text-destructive/80 max-w-md" : "max-w-md"}>
                        {description}
                    </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <div className="flex gap-2">
                        <Button onClick={action?.onClick} className={"cursor-pointer"}>{action?.icon}{action.label}</Button>
                        {secondaryAction && <Button variant="outline" onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
                    </div>
                </EmptyContent>
                {link && <Button
                    variant="link"
                    className="text-muted-foreground"
                    size="sm"
                >
                    <a href={link.url}>
                        {link.label} <ArrowUpRightIcon />
                    </a>
                </Button>}
            </Empty>
        )
    }

export default EmptyState;