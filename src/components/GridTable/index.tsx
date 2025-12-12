import React, { useMemo } from 'react';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { PlusCircleIcon, Filter, RefreshCw } from 'lucide-react';
import './style.css';

ModuleRegistry.registerModules([AllCommunityModule]);

interface GridTableProps extends AgGridReactProps {
  title?: string;
  subtitle?: string;
  showActions?: boolean;
  onAdd?: () => void;
  onFilter?: () => void;
  onRefresh?: () => void;
  addButtonLabel?: string;
  loading?: boolean;
}

const GridTable: React.FC<GridTableProps> = ({
  title,
  subtitle,
  showActions = false,
  onAdd,
  onFilter,
  onRefresh,
  addButtonLabel = 'Add New',
  loading = false,
  columnDefs,
  rowData,
  defaultColDef,
  ...gridProps
}) => {
  const defaultColumnDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
      ...defaultColDef,
    }),
    [defaultColDef]
  );

  return (
    <div className="grid-table-container">
      {(title || showActions) && (
        <div className="table-header">
          {title && (
            <div className="table-title-section">
              <h2>{title}</h2>
              {subtitle && <p className="table-subtitle">{subtitle}</p>}
            </div>
          )}
          {showActions && (
            <div className="table-actions">
              {onFilter && (
                <button className="table-action-btn" onClick={onFilter}>
                  <Filter size={14} />
                  <span>Filter</span>
                </button>
              )}
              {onRefresh && (
                <button 
                  className="table-action-btn" 
                  onClick={onRefresh}
                  disabled={loading}
                >
                  <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                  <span>Refresh</span>
                </button>
              )}
              {onAdd && (
                <button className="table-action-btn" onClick={onAdd}>
                  <PlusCircleIcon size={14} />
                  <span>{addButtonLabel}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="ag-theme-alpine-dark table-wrapper">
        <AgGridReact
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={defaultColumnDef}
          suppressCellFocus={true}
          rowSelection={{
            mode: 'singleRow',
            checkboxes: false,
            enableClickSelection: true,
          }}
          domLayout="autoHeight"
          {...gridProps}
        />
      </div>
    </div>
  );
};

export default GridTable;