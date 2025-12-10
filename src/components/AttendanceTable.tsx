import React, { useMemo } from 'react'
import { MoreVertical, Download, Filter } from 'lucide-react';
import GridTable from '../ui/grid-table';
import './AttendanceTable.css';
import { LoyaltyTierEnum, type AttendanceType, type LoyaltyType, type UserType } from '../entities/schemas';
import type { ColDef } from 'ag-grid-community';


const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  return (
    <span className={`status-badge ${status ? 'active' : 'inactive'}`}>
      {status}
    </span>
  );
};

const MembershipBadge: React.FC<{ level: string }> = ({ level }) => {
  return (
    <span className={`membership-badge ${level?.toLowerCase()}`}>
      {level}
    </span>
  );
};

const AttendanceBar: React.FC<{ rate: number }> = ({ rate }) => {
  const getColor = (rate: number) => {
    if (rate >= 90) return '#d4ff00';
    if (rate >= 75) return '#00ff88';
    return '#ff9800';
  };

  return (
    <div className="attendance-bar-container">
      <div className="attendance-bar">
        <div
          className="attendance-fill"
          style={{ width: `${rate}%`, backgroundColor: getColor(rate) }}
        />
      </div>
      <span className="attendance-percentage">{rate}%</span>
    </div>
  );
};

const columnDefs: ColDef<UserType & LoyaltyType & AttendanceType>[] = [
  {
    field: 'id',
    headerName: 'Member ID',
    width: 120
  },
  {
    field: 'firstName',
    headerName: 'Member Name',
    width: 180,
    filter: true,
  },
  {
    field: 'lastName',
    headerName: 'Member Name',
    width: 180,
    filter: true,
  },
  {
    field: 'email',
    headerName: 'Email',
    width: 220,
    filter: true,
  },
  {
    field: 'tier',
    headerName: 'Tier',
    width: 130,
    cellRenderer: (params: any) => {
      const enums = Object.keys(LoyaltyTierEnum.enum);
      const idx = Math.floor(Math.random() * enums.length);
      const rand = enums[idx]
      return <MembershipBadge level={params.value || rand} />
    },
    filter: true,
  },
  {
    field: 'updatedAt',
    headerName: 'Last Attended',
    width: 140,
    filter: 'agDateColumnFilter',
  },
  {
    headerName: 'Total Events',
    width: 130,
    filter: 'agNumberColumnFilter',
    cellRenderer: () => (<>{Math.floor(Math.random() * 100)}</>)
  },
  {
    field: 'checkInTime',
    headerName: 'Attendance Rate',
    width: 200,
    cellRenderer: (params: any) => <AttendanceBar rate={params.value} />,
    filter: 'agNumberColumnFilter',
  },
  {
    field: 'points',
    headerName: 'Points',
    width: 120,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params: any) => (params.value || String(Math.floor(Math.random() * 100))).toLocaleString(),
  },
  {
    field: 'attended',
    headerName: 'Status',
    width: 120,
    cellRenderer: (params: any) => <StatusBadge status={params.value} />,
    filter: true,
  },
  {
    headerName: 'Actions',
    width: 100,
    cellRenderer: () => (
      <button className="action-btn">
        <MoreVertical size={18} />
      </button>
    ),
    pinned: 'right',
  },
];

export const AttendanceTable: React.FC<{ rowData: UserType[] }> = ({ rowData }) => {

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
  }), []);

  return (
    <div className="attendance-table-container">
      <div className="table-header">
        <div className="table-title-section">
          <h2>Member Attendance Records</h2>
          <p className="table-subtitle">{rowData.length} total members</p>
        </div>
        <div className="table-actions">
          <button className="table-action-btn">
            <Filter size={18} />
            <span>Filter</span>
          </button>
          <button className="table-action-btn">
            <Download size={18} />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="ag-theme-alpine-dark table-wrapper">
        <GridTable
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          suppressCellFocus={true}
          rowSelection={{
            mode: 'singleRow',
            checkboxes: false,
            enableClickSelection: true
          }}
          domLayout="autoHeight"
        />
      </div>
    </div>
  );
};
