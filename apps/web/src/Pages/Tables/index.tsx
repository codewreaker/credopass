// ============================================================================
// FILE: src/Pages/Database/index.tsx
// Admin page to view all database tables using reusable GridTable component
// ============================================================================

import { useState, useMemo, useCallback } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { getCollections } from '@credopass/api-client/collections';
import GridTable, { type MenuItem } from '../../components/grid-table/index';
import {
  RefreshCw, DatabaseBackup, AppWindowIcon, BuildingIcon, Building2,
  TicketCheck, Users, UserPlus
} from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import Loader from '../../components/loader';
import { useToolbarContext } from '../../hooks/use-toolbar-context';
import './style.css';

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@credopass/ui/components/tabs"
import { useIsMobile } from '@credopass/ui/hooks/use-mobile';
import { toast } from 'sonner';

const GRID_EXT = '_grid';

type TableName = 'users' | 'events' | 'attendance' | 'loyalty' | 'organizations' | 'orgMemberships' | 'eventMembers';

const IconMapping: { [key in TableName]: React.ElementType } = {
  users: AppWindowIcon,
  events: TicketCheck,
  attendance: DatabaseBackup,
  loyalty: Building2,
  organizations: BuildingIcon,
  orgMemberships: Users,
  eventMembers: UserPlus,
};


export default function DatabasePage() {
  const [selectedTable, setSelectedTable] = useState<TableName>('users');
  const isMobile = useIsMobile();

  // Tables page: no search, no secondary action
  useToolbarContext({
    action: null,
    search: { enabled: false, placeholder: '' },
  });

  const tables: TableName[] = ['users', 'events', 'attendance', 'loyalty', 'organizations', 'orgMemberships', 'eventMembers'];

  // Get all collections
  const {
    users: userCollection,
    events: eventCollection,
    attendance: attendanceCollection,
    loyalty: loyaltyCollection,
    organizations: organizationCollection,
    orgMemberships: orgMembershipCollection,
    eventMembers: eventMemberCollection,
  } = getCollections();

  // Map collections for easy access
  const collectionMap = useMemo(() => ({
    users: userCollection,
    events: eventCollection,
    attendance: attendanceCollection,
    loyalty: loyaltyCollection,
    organizations: organizationCollection,
    orgMemberships: orgMembershipCollection,
    eventMembers: eventMemberCollection,
  }), [userCollection, eventCollection, attendanceCollection, loyaltyCollection, organizationCollection, orgMembershipCollection, eventMemberCollection]);

  // Query all tables using useLiveQuery
  const { data: usersData, isLoading: usersLoading } = useLiveQuery(
    (q) => q.from({ userCollection })
  );
  const { data: eventsData, isLoading: eventsLoading } = useLiveQuery(
    (q) => q.from({ eventCollection })
  );
  const { data: attendanceData, isLoading: attendanceLoading } = useLiveQuery(
    (q) => q.from({ attendanceCollection })
  );
  const { data: loyaltyData, isLoading: loyaltyLoading } = useLiveQuery(
    (q) => q.from({ loyaltyCollection })
  );
  const { data: organizationsData, isLoading: organizationsLoading } = useLiveQuery(
    (q) => q.from({ organizationCollection })
  );
  const { data: orgMembershipsData, isLoading: orgMembershipsLoading } = useLiveQuery(
    (q) => q.from({ orgMembershipCollection })
  );
  const { data: eventMembersData, isLoading: eventMembersLoading } = useLiveQuery(
    (q) => q.from({ eventMemberCollection })
  );

  // Map table data and loading states
  const tableData = useMemo(() => ({
    users: Array.isArray(usersData) ? usersData : [],
    events: Array.isArray(eventsData) ? eventsData : [],
    attendance: Array.isArray(attendanceData) ? attendanceData : [],
    loyalty: Array.isArray(loyaltyData) ? loyaltyData : [],
    organizations: Array.isArray(organizationsData) ? organizationsData : [],
    orgMemberships: Array.isArray(orgMembershipsData) ? orgMembershipsData : [],
    eventMembers: Array.isArray(eventMembersData) ? eventMembersData : [],
  }), [usersData, eventsData, attendanceData, loyaltyData, organizationsData, orgMembershipsData, eventMembersData]);

  const loadingStates: Record<TableName, boolean> = {
    users: usersLoading,
    events: eventsLoading,
    attendance: attendanceLoading,
    loyalty: loyaltyLoading,
    organizations: organizationsLoading,
    orgMemberships: orgMembershipsLoading,
    eventMembers: eventMembersLoading,
  };

  const loading = loadingStates[selectedTable];

  // Refresh handler using collection.utils.refetch
  const handleRefresh = useCallback(() => {
    collectionMap[selectedTable].utils.refetch();
  }, [collectionMap, selectedTable]);

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
        action: handleRefresh,
      },
    ],
    [handleRefresh]
  );

  const handleDbDelete = (selectedItems: any[], gridId?: string) => {
    const tableName = (gridId?.split(GRID_EXT)[0] || selectedTable) as TableName;

    const collection = collectionMap[tableName];
    if (!collection) return;

    toast.success(`Deleting ${selectedItems.length} item(s) from ${tableName} table.`);
    selectedItems.forEach((item) => {
      collection.delete(item.id);
    });
  }


  return (    
    <>
        <Tabs defaultValue={selectedTable} className="flex ml-auto pt-2 pb-2 w-full" value={selectedTable} orientation={isMobile ? "vertical" : "horizontal"} >
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
      ) : (<Loader />)}
    </>
  );
}
