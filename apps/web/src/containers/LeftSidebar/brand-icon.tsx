export default function ({ size = 16 }: { size?: number }) {
    const iconSize = size * 16;
    return (
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${iconSize} ${iconSize}`} className="size-4">
                <rect width={iconSize} height={iconSize} fill="none"></rect>
                <line
                    x1="208"
                    y1="128"
                    x2="128"
                    y2="208"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="32"
                ></line>
                <line
                    x1="192"
                    y1="40"
                    x2="40"
                    y2="192"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="32"
                ></line>
            </svg>
        </div>
    )
}