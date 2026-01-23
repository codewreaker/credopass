// ============================================================================
// FILE: src/Pages/Database/index.tsx
// Admin page to view all database tables using reusable GridTable component
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import GridTable, { type MenuItem } from '../../components/grid-table/index';
import {
  RefreshCw, DatabaseBackup, AppWindowIcon, BuildingIcon, Building2,
  TicketCheck

} from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { API_BASE_URL } from '../../config';
import Loader from '../../components/loader';
import './style.css';
import EmptyState from '../../components/empty-state';

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@credopass/ui/components/tabs"
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';

const GRID_EXT = '_grid';

type TableName = 'users' | 'events' | 'attendance' | 'loyalty' | 'organizations';

interface TableData {
  [key: string]: any[];
}


const IconMapping: { [key in TableName]: React.ElementType } = {
  users: AppWindowIcon,
  events: TicketCheck,
  attendance: DatabaseBackup,
  loyalty: Building2,
  organizations: BuildingIcon,
};


export default function DatabasePage() {
  const [selectedTable, setSelectedTable] = useState<TableName>('users');
  const [tableData, setTableData] = useState<TableData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const tables: TableName[] = ['users', 'events', 'attendance', 'loyalty', 'organizations'];

  const fetchTableData = async (table: TableName) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/${table}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${table}`);
      }
      const data = await response.json();

      setTableData(prev => ({
        ...prev,
        [table]: data,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTableData(selectedTable);
  }, [selectedTable]);

  // Generate column definitions dynamically from data
  const generateColumnDefs = (data: any[]): ColDef[] => {
    if (!data || data.length === 0) return [];

    const columns = Object.keys(data[0]);
    return columns.map(col => ({
      field: col,
      headerName: col.charAt(0).toUpperCase() + col.slice(1),
      flex: 1,
      minWidth: 150,
      valueFormatter: (params: any) => {
        if (params.value === null || params.value === undefined) return '-';
        if (typeof params.value === 'object') return JSON.stringify(params.value);
        return String(params.value);
      },
    }));
  };

  const currentData = tableData[selectedTable] || [];
  const columnDefs = generateColumnDefs(currentData);

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'refresh',
        label: 'Refresh',
        icon: <RefreshCw />,
        action: () => fetchTableData(selectedTable),
      },
    ],
    [selectedTable]
  );

  const handleDbDelete = (selectedItems: any[], gridId?: string) => {
    const gridName = gridId?.split(GRID_EXT)[0];
    console.log('Delete action for items:', selectedItems, 'in grid:', gridName);
    // Implement delete logic here
  }


  return (    
    <>
        <Tabs defaultValue="preview" className="flex ml-auto pt-2 pb-2 w-full" value={selectedTable} orientation={isMobile ? "vertical" : "horizontal"} >
          <TabsList className="w-full">
            {tables.map((table) => {
              const Icon = IconMapping[table];
              return (
                <TabsTrigger
                  key={table}
                  value={table}
                  onClick={() => setSelectedTable(table)}
                >
                  <Icon size={16} style={{ marginRight: 4 }} />
                  {table.charAt(0).toUpperCase() + table.slice(1)}
                  {tableData[table] ? ` (${tableData[table].length})` : ' (--)'}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

      {!loading ? (
        !error ? (
          <GridTable
            gridId={selectedTable + GRID_EXT}
            title={`${selectedTable.charAt(0).toUpperCase() + selectedTable.slice(1)} Table`}
            subtitle={currentData.length > 0 ? `${currentData.length} records` : 'No records found'}
            bulkActions={[
              {
                key: 'delete',
                label: 'Delete',
                action: handleDbDelete,
                variant: 'destructive'
              }
            ]}
            rowSelection={{
              mode: 'multiRow',
            }}
            menu={menuItems}
            loading={loading}
            columnDefs={columnDefs}
            rowData={currentData}
          />
        ) : <EmptyState
          error
          title={`Error Loading ${selectedTable}`}
          icon={<DatabaseBackup />}
          description={`An error occurred while fetching ${selectedTable}: ${error}`}
          action={{ label: "Retry", onClick: () => fetchTableData(selectedTable) }}
        />
      ) : (<Loader />)}
    </>
  );
}
