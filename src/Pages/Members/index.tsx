import { AttendanceBar, AttendanceTable, MembershipBadge, StatusBadge } from '../../containers/AttendanceTable'
import { useLiveQuery } from '@tanstack/react-db'
import { LoyaltyTierEnum, type AttendanceType, type LoyaltyType, type UserType } from '../../entities/schemas'
import { userCollection } from '../../collections/user'
//import { User } from '../../entities/user'
import type { ColDef, RowClickedEvent } from 'ag-grid-community'
import { MoreVertical } from 'lucide-react'


const hdl = (type: string, e?: React.SyntheticEvent | RowClickedEvent) => {
  switch (type) {
    default:
      console.log(e)
      alert(type)
      return
  }
}


// const createUser = () => {
//   const user = new User(
//     'Israel',
//     'Agyeman-Prmepeh',
//     `user${crypto.randomUUID()}@email.com`,
//     '+563456765'
//   )
//   user.validate()
//   console.log('user', user.loyaltyTier)
//   userCollection.insert(user)
// }

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

export default function MembersPage() {
  const { data } = useLiveQuery((q) => q.from({ userCollection }))
  const rows: UserType[] = Array.isArray(data) ? data : []

  return (
    <div className="placeholder-content">
      <AttendanceTable columnDefs={columnDefs} rowData={rows} handleAction={hdl} />
    </div>
  )
}
