
import { FC } from 'react';

import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

import './style.css'

ModuleRegistry.registerModules([AllCommunityModule]);

const GridTable: FC<AgGridReactProps> = (props) => {
    return (
        <div className="ag-theme-alpine-dark table-wrapper">
            <AgGridReact {...props} />
        </div>
    )
}

export default GridTable