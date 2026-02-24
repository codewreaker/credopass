import { Spinner, Button } from '@credopass/ui';

export function Loader({message = "Please wait"}: {message?: string}) {
    return (
        <div className="flex flex-col items-center justify-center h-full">
            <Button variant="secondary" disabled size="sm">
                <Spinner />
                {message}
            </Button>
        </div>
    )
}