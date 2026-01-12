// ============================================================================
// FILE: src/Pages/Database/index.tsx
// Admin page to view all database tables using reusable GridTable component
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import GridTable, { type MenuItem } from '../../components/grid-table/index';
import { Button } from '@credopass/ui';
import { RefreshCw } from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { API_BASE_URL } from '../../config';
import Loader from '../../components/loader';
import './style.css';
import EmptyState from '../../components/empty-state';

type TableName = 'users' | 'events' | 'attendance' | 'loyalty';

interface TableData {
  [key: string]: any[];
}

export default function DatabasePage() {
  const [selectedTable, setSelectedTable] = useState<TableName>('users');
  const [tableData, setTableData] = useState<TableData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tables: TableName[] = ['users', 'events', 'attendance', 'loyalty'];

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

  if (loading) return <Loader />;

  return (
    <>
      <div className="database-page-header">
        <div className="page-header">
          <h1>Database Admin</h1>
          <p className="page-subtitle">View all database tables</p>
        </div>
        <div className="table-selector">
          {tables.map(table => (
            <Button
              key={table}
              variant="outline"
              className={selectedTable === table ? 'active' : ''}
              onClick={() => setSelectedTable(table)}
            >
              {table.charAt(0).toUpperCase() + table.slice(1)}
              {tableData[table] && (
                <span className="count">({tableData[table].length})</span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {!error ? (
        <GridTable
          title={`${selectedTable.charAt(0).toUpperCase() + selectedTable.slice(1)} Table`}
          subtitle={currentData.length > 0 ? `${currentData.length} records` : 'No records found'}
          menu={menuItems}
          loading={loading}
          columnDefs={columnDefs}
          rowData={currentData}
        />
      ) : <EmptyState
        error
        title={`Error Loading ${selectedTable}`}
        description={`An error occurred while fetching ${selectedTable}: ${error}`}
        action={{ label: "Retry", onClick: () => fetchTableData(selectedTable) }}
      />}
    </>
  );
}
