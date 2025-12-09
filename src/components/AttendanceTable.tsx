import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { MoreVertical, Download, Filter } from 'lucide-react';
import './AttendanceTable.css';
import type { UserType } from '../entities/schemas';

interface AttendanceRecord {
  id: string;
  memberName: string;
  email: string;
  membershipLevel: string;
  lastAttended: string;
  totalEvents: number;
  attendanceRate: number;
  points: number;
  status: string;
}

const mockData: AttendanceRecord[] = [
  { id: 'M001', memberName: 'John Smith', email: 'john.smith@email.com', membershipLevel: 'Platinum', lastAttended: '2024-12-08', totalEvents: 45, attendanceRate: 95, points: 4500, status: 'Active' },
  { id: 'M002', memberName: 'Sarah Johnson', email: 'sarah.j@email.com', membershipLevel: 'Gold', lastAttended: '2024-12-07', totalEvents: 38, attendanceRate: 89, points: 3800, status: 'Active' },
  { id: 'M003', memberName: 'Michael Chen', email: 'mchen@email.com', membershipLevel: 'Silver', lastAttended: '2024-12-05', totalEvents: 28, attendanceRate: 76, points: 2800, status: 'Active' },
  { id: 'M004', memberName: 'Emily Davis', email: 'emily.d@email.com', membershipLevel: 'Gold', lastAttended: '2024-12-08', totalEvents: 42, attendanceRate: 92, points: 4200, status: 'Active' },
  { id: 'M005', memberName: 'Robert Wilson', email: 'rwilson@email.com', membershipLevel: 'Platinum', lastAttended: '2024-12-06', totalEvents: 50, attendanceRate: 98, points: 5000, status: 'Active' },
  { id: 'M006', memberName: 'Lisa Anderson', email: 'lisa.a@email.com', membershipLevel: 'Silver', lastAttended: '2024-11-30', totalEvents: 22, attendanceRate: 68, points: 2200, status: 'Inactive' },
  { id: 'M007', memberName: 'David Martinez', email: 'dmartinez@email.com', membershipLevel: 'Gold', lastAttended: '2024-12-07', totalEvents: 35, attendanceRate: 85, points: 3500, status: 'Active' },
  { id: 'M008', memberName: 'Jennifer Taylor', email: 'jtaylor@email.com', membershipLevel: 'Bronze', lastAttended: '2024-12-02', totalEvents: 18, attendanceRate: 62, points: 1800, status: 'Active' },
  { id: 'M009', memberName: 'James Brown', email: 'jbrown@email.com', membershipLevel: 'Platinum', lastAttended: '2024-12-08', totalEvents: 48, attendanceRate: 96, points: 4800, status: 'Active' },
  { id: 'M010', memberName: 'Patricia Garcia', email: 'pgarcia@email.com', membershipLevel: 'Gold', lastAttended: '2024-12-06', totalEvents: 40, attendanceRate: 90, points: 4000, status: 'Active' },
];

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  return (
    <span className={`status-badge ${status.toLowerCase()}`}>
      {status}
    </span>
  );
};

const MembershipBadge: React.FC<{ level: string }> = ({ level }) => {
  return (
    <span className={`membership-badge ${level.toLowerCase()}`}>
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

export const AttendanceTable: React.FC<{rowData:UserType[]}> = ({rowData}) => {
  //const [rowData] = useState<AttendanceRecord[]>(mockData);
  
  const columnDefs = useMemo(() => [
    { 
      field: 'id', 
      headerName: 'Member ID',
      width: 120,
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    { 
      field: 'memberName', 
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
      field: 'membershipLevel', 
      headerName: 'Level',
      width: 130,
      cellRenderer: (params: any) => <MembershipBadge level={params.value} />,
      filter: true,
    },
    { 
      field: 'lastAttended', 
      headerName: 'Last Attended',
      width: 140,
      filter: 'agDateColumnFilter',
    },
    { 
      field: 'totalEvents', 
      headerName: 'Total Events',
      width: 130,
      filter: 'agNumberColumnFilter',
    },
    { 
      field: 'attendanceRate', 
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
      valueFormatter: (params: any) => params.value.toLocaleString(),
    },
    { 
      field: 'status', 
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
  ], []);

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
      
      <div className="ag-theme-alpine-dark table-wrapper" style={{height:800}}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowSelection="multiple"
          pagination={true}
          paginationPageSize={10}
          domLayout="autoHeight"
        />
      </div>
    </div>
  );
};
