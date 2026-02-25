import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeMaterial, type SelectionChangedEvent, GridApi, type ICellRendererParams, GridReadyEvent } from 'ag-grid-community';
import { Eye } from 'lucide-react';
import Header, { type BulkActionItem } from './Header';
import { useAppStore } from '@credopass/lib/stores';
import './style.css';
import { cn } from '@credopass/ui/lib/utils';
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';

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
  bulkActions?: BulkActionItem[];
}


// to use myTheme in an application, pass it to the theme grid option
const theme = themeMaterial
  .withParams({
    backgroundColor: 'var(--background)',
    headerBackgroundColor: 'var(--background-darker)',
    headerTextColor: 'var(--primary)',
    oddRowBackgroundColor: 'var(--card)',
    rowHoverColor: 'rgba(212, 255, 0, 0.05)',
    selectedRowBackgroundColor: 'rgba(212, 255, 0, 0.1)',
    borderColor: 'var(--border)',
    foregroundColor: 'var(--foreground)',
    browserColorScheme: "dark",
    checkboxUncheckedBackgroundColor: 'var(--foreground)',
    checkboxCheckedBackgroundColor: 'var(--primary)',
    checkboxIndeterminateBackgroundColor: 'var(--primary)',
    chromeBackgroundColor: {
      ref: "foregroundColor",
      mix: 0.07,
      onto: "backgroundColor"
    },
    fontSize: 13,
    headerFontSize: 12,
    spacing: 4
  });


const GridTable: React.FC<GridTableProps> = ({
  title,
  subtitle,
  menu = [],
  loading = false,
  bulkActions = [],
  columnDefs,
  rowData,
  defaultColDef,
  gridOptions,
  rowSelection = {
    mode: 'singleRow',
    checkboxes: false,
    enableClickSelection: true,
  },
  onGridReady,
  gridId = '__unnamed_grid__',
  ...gridProps
}) => {
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const isMobile = useIsMobile();

  // const viewItemSet = useAppStore(state => state.viewedItem !== null);
  const setViewedItem = useAppStore(state => state.setViewedItem);
  const toggleSidebar = useAppStore(state => state.toggleSidebar);


  useEffect(() => {
    if (!gridApi) return;

    const onSelectionChanged = (event: SelectionChangedEvent) => {
      setSelectedItems(event.api.getSelectedRows());
    };

    gridApi.addEventListener('selectionChanged', onSelectionChanged);
    return () => {
      gridApi.removeEventListener('selectionChanged', onSelectionChanged);
    };
  }, [gridApi]);

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
      suppressCellFocus: true,
    }),
    [gridOptions]
  );


  const viewActionRenderer = useCallback(({ data }: ICellRendererParams) => {
    return (
      <div
        className="view-action-btn"
        onClick={(e) => {
          e.stopPropagation();
          setViewedItem({ id: 'profile', content: data });
          toggleSidebar('right');
        }}
      >
        <Eye size={18} />
      </div>
    )
  }, [setViewedItem, toggleSidebar]);

  const memoizedColumnDefs = useMemo(() => {
    if (!columnDefs) return [];

    return [
      {
        headerName: "",
        width: 18,
        maxWidth: 18,
        minWidth: 18,
        resizable: false,
        sortable: false,
        filter: false,
        cellRenderer: viewActionRenderer,
        cellClass: "view-action-cell",
      },
      ...columnDefs
    ];
  }, [columnDefs, viewActionRenderer]);

  const memoizedOnGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
    onGridReady?.(params);
  }, [onGridReady]);

  return (
    <div className={cn("grid-table-container rounded-lg overflow-hidden border", isMobile ? "h-screen" : "h-[calc(100%-80px)]")}>
      <Header
        title={title}
        subtitle={subtitle}
        menu={menu}
        loading={loading}
        selectedItems={selectedItems}
        bulkActions={bulkActions}
        gridId={gridId}
      />
      <AgGridReact
        onGridReady={memoizedOnGridReady}
        columnDefs={memoizedColumnDefs}
        rowData={rowData}
        defaultColDef={defaultColumnDef}
        theme={theme}
        rowSelection={rowSelection}
        gridOptions={gridOptionsMemoized}
        gridId={gridId}
        {...gridProps}
      />
    </div>
  );
};

export { GridTable };
export default GridTable;