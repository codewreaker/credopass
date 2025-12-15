import { useLiveQuery } from '@tanstack/react-db'
import { LoyaltyTierEnum, type AttendanceType, type LoyaltyType, type UserType } from '../../db/schema.js'
import { userCollection } from '../../collections/user.js'
import type { ColDef, RowClickedEvent } from 'ag-grid-community'
import { MoreVertical } from 'lucide-react'

import React from "react";
import GridTable, { type MenuItem } from "../../components/GridTable/index.js";
import { PlusCircle, Filter } from "lucide-react";
import { useLauncher } from '../../store.js';
import { launchUserForm } from '../../containers/UserForm/index.js';


const hdl = (type: string, e?: React.SyntheticEvent | RowClickedEvent) => {
  switch (type) {
    default:
      console.log(e)
      return
  }
}

const columnDefs: ColDef<UserType & LoyaltyType & AttendanceType>[] = [
  {
    field: 'id',
    headerName: 'Member ID',
    width: 90
  },
  {
    field: 'firstName',
    headerName: 'Member Name',
    width: 135,
    filter: true,
  },
  {
    field: 'lastName',
    headerName: 'Member Name',
    width: 135,
    filter: true,
  },
  {
    field: 'email',
    headerName: 'Email',
    width: 165,
    filter: true,
  },
  {
    field: 'tier',
    headerName: 'Tier',
    width: 98,
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
    width: 105,
    filter: 'agDateColumnFilter',
  },
  {
    headerName: 'Total Events',
    width: 98,
    filter: 'agNumberColumnFilter',
    cellRenderer: () => (<>{Math.floor(Math.random() * 100)}</>)
  },
  {
    field: 'checkInTime',
    headerName: 'Attendance Rate',
    width: 150,
    cellRenderer: (params: any) => <AttendanceBar rate={params.value} />,
    filter: 'agNumberColumnFilter',
  },
  {
    field: 'points',
    headerName: 'Points',
    width: 90,
    filter: 'agNumberColumnFilter',
    valueFormatter: (params: any) => (params.value || String(Math.floor(Math.random() * 100))).toLocaleString(),
  },
  {
    field: 'attended',
    headerName: 'Status',
    width: 90,
    cellRenderer: (params: any) => <StatusBadge status={params.value} />,
    filter: true,
  },
  {
    headerName: 'Actions',
    width: 75,
    cellRenderer: () => (
      <button className="action-btn">
        <MoreVertical size={14} />
      </button>
    ),
    pinned: 'right',
  },
];

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  return (
    <span className={`status-badge ${status ? "active" : "inactive"}`}>
      {status}
    </span>
  );
};

const MembershipBadge: React.FC<{ level: string }> = ({ level }) => {
  return (
    <span className={`membership-badge ${level?.toLowerCase()}`}>{level}</span>
  );
};

const AttendanceBar: React.FC<{ rate: number }> = ({ rate }) => {
  const getColor = (rate: number) => {
    if (rate >= 90) return "#d4ff00";
    if (rate >= 75) return "#00ff88";
    return "#ff9800";
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


export default function MembersPage() {
  const { data } = useLiveQuery((q) => q.from({ userCollection }))
  const rowData: UserType[] = Array.isArray(data) ? data : []
  const { openLauncher } = useLauncher();

  const menuItems: MenuItem[] = [
    {
      id: 'filter',
      label: 'Filter',
      icon: <Filter />,
      action: () => console.log('Filter clicked'),
    },
    {
      id: 'add',
      label: 'Create User',
      icon: <PlusCircle />,
      action: () => launchUserForm({ isEditing: false }, openLauncher),
    },
  ];

  return (
    <>
      <div className="page-header">
          <h1>Users</h1>
          <p className="page-subtitle">View all users</p>
      </div>

      <GridTable
        title="Member Attendance Records"
        subtitle={`${rowData.length} total members`}
        menu={menuItems}
        columnDefs={columnDefs}
        rowData={rowData}
        onRowClicked={(e) => hdl(e.type, e)}
      />
    </>

  )
}
