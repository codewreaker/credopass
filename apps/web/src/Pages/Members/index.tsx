import React, { useCallback, useState } from "react";
import { useLiveQuery } from '@tanstack/react-db'
import { type UserType, type AttendanceType, type LoyaltyType, User } from '@credopass/lib/schemas'
import { getCollections } from '@credopass/api-client/collections';
import type { ColDef, IOverlayParams, RowClickedEvent } from 'ag-grid-community'

import GridTable, { type MenuItem } from "../../components/grid-table/index";

import { PlusCircle, Filter, UserPlus } from "lucide-react";
import { useLauncher } from '@credopass/lib/stores';
import { launchUserForm } from '../../containers/UserForm/index';
import EmptyState from '../../components/empty-state';
import Loader from '../../components/loader';
import { useToolbarContext } from '@credopass/lib/hooks';


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
      return <MembershipBadge level={params.value || 'bronze'} />
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
    valueGetter: (params: any) => params.data?.totalEvents ?? 0,
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
    valueFormatter: (params: any) => (params.value ?? 0).toLocaleString(),
  },
  {
    field: 'attended',
    headerName: 'Status',
    width: 90,
    cellRenderer: (params: any) => <StatusBadge status={params.value} />,
    filter: true,
  }
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



const handleRowClick = (_type: string, _e?: React.SyntheticEvent | RowClickedEvent) => {
  // Row click handler - extend as needed
}

export default function MembersPage() {
  const { users: userCollection } = getCollections();
  const { data, isLoading } = useLiveQuery((q) => q.from({ userCollection }));
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Use collection's error tracking utilities
  const isError = userCollection.utils.isError;

  const rowData: UserType[] = Array.isArray(data) ? data : []
  const { openLauncher } = useLauncher();

  const handleCreateUser = useCallback(() => {
    launchUserForm({ isEditing: false }, openLauncher);
  }, [openLauncher]);

  // Register toolbar context: secondary "Add Person" button + search
  useToolbarContext({
    action: { icon: UserPlus, label: 'Add Person', onClick: handleCreateUser },
    search: { enabled: true, placeholder: 'Search members…', onSearch: setSearchQuery },
  });

  const deleteUser = (userIds: User[]) => {
    userIds.forEach((user) => {
      userCollection.delete(user.id);
    });
  }

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


  const overlayComponentSelector = useCallback(({ overlayType }: IOverlayParams) => {
    if (overlayType === "noRows") {
      return {
        component: EmptyState,
        params: {
          title: "No Users Found",
          description: "You haven't added any users yet. Get started by creating your first user.",
          action: { label: "Create User", onClick: () => launchUserForm({ isEditing: false }, openLauncher) }
        }
      }
    }
    // return undefined to use the provided overlay for other overlay types
    return undefined;
  }, [openLauncher]);

  if (isLoading) return <Loader />


  return (
    <>
      {!isError ?
        <GridTable
          title="Member Attendance Records"
          subtitle={`${rowData.length} total members`}
          menu={menuItems}
          columnDefs={columnDefs}
          rowData={rowData}
          quickFilterText={searchQuery}
          bulkActions={[
            {
              key: 'delete',
              label: 'Delete',
              action: deleteUser,
              variant: 'destructive'
            }
          ]}
          rowSelection={{
            mode: 'multiRow',
          }}
          overlayComponentSelector={overlayComponentSelector}
          onRowClicked={(e) => handleRowClick(e.type, e)}
        /> : (
          <GridTable
            title="Member Attendance Records (offline)"
            menu={menuItems}
            columnDefs={columnDefs}
            overlayComponent={() => (
              <EmptyState
                error
                title="Error Loading Users"
                description={`An error occurred while fetching users: ${userCollection.utils.lastError}`}
                action={{ label: "Retry", onClick: userCollection.utils.refetch }}
              />
            )}
          />
        )}
    </>

  )
}
