import React, { useMemo } from "react";
import { PlusCircleIcon, Filter } from "lucide-react";
import GridTable from "../../components/GridTable";
import "./style.css";
import type { UserType } from "../../entities/schemas";
import type { ColDef, RowClickedEvent } from "ag-grid-community";

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
  const defaultColDef = useMemo(
    () => ({
      sortable: true,
      resizable: true,
    }),
    []
  );

  return (
    <div className="attendance-table-container">
      <div className="table-header">
        <div className="table-title-section">
          <h2>Member Attendance Records</h2>
          <p className="table-subtitle">{rowData.length} total members</p>
        </div>
        <div className="table-actions">
          <button className="table-action-btn">
            <Filter size={14} />
            <span>Filter</span>
          </button>
          <button
            className="table-action-btn"
            onClick={(e) => handleAction("add", e)}
          >
            <PlusCircleIcon size={14} />
            <span>Create User</span>
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
            mode: "singleRow",
            checkboxes: false,
            enableClickSelection: true,
          }}
          onRowClicked={(e) => handleAction(e.type, e)}
          domLayout="autoHeight"
        />
      </div>
    </div>
  );
};
