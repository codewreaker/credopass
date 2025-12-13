import React, { useMemo } from 'react';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeMaterial } from 'ag-grid-community';
import Header from './Header';
import './style.css';

ModuleRegistry.registerModules([AllCommunityModule]);

export interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactElement;
  action: () => void;
  disabled?: boolean;
}

interface GridTableProps extends AgGridReactProps {
  title?: string;
  subtitle?: string;
  menu?: MenuItem[];
  loading?: boolean;
}


// to use myTheme in an application, pass it to the theme grid option
const theme = themeMaterial
  .withParams({
    backgroundColor: 'var(--dark-bg)',
    headerBackgroundColor: 'var(--darker-bg)',
    headerTextColor: 'var(--primary-yellow)',
    oddRowBackgroundColor: 'var(--card-bg)',
    rowHoverColor: 'rgba(212, 255, 0, 0.05)',
    selectedRowBackgroundColor: 'rgba(212, 255, 0, 0.1)',
    borderColor: 'var(--border-color)',
    foregroundColor: 'var(--text-primary)',
    browserColorScheme: "dark",
    checkboxUncheckedBackgroundColor: 'var(--primary-yellow)',
    checkboxCheckedBackgroundColor: 'var(--primary-yellow)',
    checkboxIndeterminateBackgroundColor: 'var(--primary-yellow)',
    chromeBackgroundColor: {
      ref: "foregroundColor",
      mix: 0.07,
      onto: "backgroundColor"
    },
    fontSize: 13,
    headerFontSize: 12,
    spacing: 6
  });


const GridTable: React.FC<GridTableProps> = ({
  title,
  subtitle,
  menu = [],
  loading = false,
  columnDefs,
  rowData,
  defaultColDef,
  gridOptions,
  ...gridProps
}) => {
  const defaultColumnDef = useMemo(
    () => ({
      ...defaultColDef,
      sortable: true,
      resizable: true,
      editable: true,
    }),
    [defaultColDef]
  );

  const gridOptionsMemoized = useMemo(
    () => ({
      ...gridOptions,
      cellSelection: true,
      suppressCellFocus: true
    }),
    [gridOptions]
  );

  return (
    <div className="grid-table-container">
      <Header
        title={title}
        subtitle={subtitle}
        menu={menu}
        loading={loading}
      />
        <AgGridReact
          columnDefs={columnDefs}
          rowData={rowData}
          defaultColDef={defaultColumnDef}
          theme={theme}
          rowSelection={{
            mode: 'singleRow',
            checkboxes: false,
            enableClickSelection: true,
          }}
          domLayout="autoHeight"
          gridOptions={gridOptionsMemoized}
          {...gridProps}
        />
    </div>
  );
};

export default GridTable;