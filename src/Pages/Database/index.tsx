// ============================================================================
// FILE: src/Pages/Database/index.tsx
// Admin page to view all database tables
// ============================================================================

import { useState, useEffect } from 'react';
import './style.css';

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
      const response = await fetch(`/api/${table}`);
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

  const renderTableContent = () => {
    const data = tableData[selectedTable];
    
    if (loading) {
      return <div className="loading">Loading...</div>;
    }
    
    if (error) {
      return <div className="error">Error: {error}</div>;
    }
    
    if (!data || data.length === 0) {
      return <div className="empty">No data found</div>;
    }

    const columns = Object.keys(data[0]);

    return (
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx}>
                {columns.map(col => (
                  <td key={col}>
                    {row[col] !== null && row[col] !== undefined
                      ? typeof row[col] === 'object'
                        ? JSON.stringify(row[col])
                        : String(row[col])
                      : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="database-page">
      <h1>Database Admin</h1>
      <p className="subtitle">View all database tables</p>

      <div className="table-selector">
        {tables.map(table => (
          <button
            key={table}
            className={`table-button ${selectedTable === table ? 'active' : ''}`}
            onClick={() => setSelectedTable(table)}
          >
            {table.charAt(0).toUpperCase() + table.slice(1)}
            {tableData[table] && (
              <span className="count">({tableData[table].length})</span>
            )}
          </button>
        ))}
      </div>

      <div className="table-info">
        <h2>{selectedTable.charAt(0).toUpperCase() + selectedTable.slice(1)} Table</h2>
        <button 
          className="refresh-button"
          onClick={() => fetchTableData(selectedTable)}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {renderTableContent()}
    </div>
  );
}
