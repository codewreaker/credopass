import React from "react";
import GridTable from "../../components/GridTable";
import "./style.css";
import type { UserType } from "../../entities/schemas";
import type { ColDef, RowClickedEvent } from "ag-grid-community";
import { useAppStore } from "../../store";

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  return (
    <span className={`status-badge ${status ? "active" : "inactive"}`}>
      {status}
    </span>
  );
};

export const MembershipBadge: React.FC<{ level: string }> = ({ level }) => {
  return (
    <span className={`membership-badge ${level?.toLowerCase()}`}>{level}</span>
  );
};

export const AttendanceBar: React.FC<{ rate: number }> = ({ rate }) => {
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

export const AttendanceTable: React.FC<{
  columnDefs: ColDef[];
  rowData: UserType[];
  handleAction: (
    type: string,
    event?: React.SyntheticEvent | RowClickedEvent
  ) => void;
}> = ({ columnDefs, rowData, handleAction }) => {
  const addEvent = useAppStore((state) => state.addEvent);
  const addUser = () => addEvent('add');

  return (
    <GridTable
      title="Member Attendance Records"
      subtitle={`${rowData.length} total members`}
      showActions={true}
      onAdd={addUser}
      onFilter={() => console.log('Filter clicked')}
      addButtonLabel="Create User"
      columnDefs={columnDefs}
      rowData={rowData}
      onRowClicked={(e) => handleAction(e.type, e)}
    />
  );
};
