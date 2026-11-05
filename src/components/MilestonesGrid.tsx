"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef } from "ag-grid-community";
import type { MilestoneStatus } from "@/lib/types";
import StatusBadge from "./StatusBadge";
import { shortDate, inr } from "./format";

ModuleRegistry.registerModules([AllCommunityModule]);

export interface Row {
  contractId: string;
  contract: string;
  milestone: string;
  amount: number;
  status: MilestoneStatus;
  score: number | null;
  passed: string;
  attempts: number;
  due: string;
  authorizationId: string;
  captureId: string;
}

const theme = themeQuartz.withParams({
  fontFamily: "inherit",
  fontSize: 13,
  headerFontSize: 12,
  headerFontWeight: 500,
  headerTextColor: "#667085",
  headerBackgroundColor: "#f7f8fa",
  borderColor: "#e4e7ec",
  rowHoverColor: "#f7f8fa",
  accentColor: "#3538cd",
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  rowHeight: 44,
  headerHeight: 40,
});

export default function MilestonesGrid({ rows }: { rows: Row[] }) {
  const router = useRouter();

  const columns = useMemo((): ColDef<Row>[] => [
    { field: "contract", headerName: "Contract", flex: 1.3, minWidth: 200, filter: true },
    { field: "milestone", headerName: "Milestone", flex: 1.3, minWidth: 200, filter: true },
    { field: "status", headerName: "Status", width: 190, filter: true, cellRenderer: (p: { value: MilestoneStatus }) => <StatusBadge status={p.value} /> },
    { field: "amount", headerName: "Amount", width: 120, type: "rightAligned", valueFormatter: (p) => inr(p.value) },
    { field: "passed", headerName: "Criteria met", width: 125 },
    { field: "score", headerName: "Score", width: 95, valueFormatter: (p) => (p.value == null ? "—" : String(p.value)) },
    { field: "attempts", headerName: "Attempts", width: 105 },
    { field: "due", headerName: "Due", width: 100, sort: "asc", valueFormatter: (p) => shortDate(p.value) },
    { field: "authorizationId", headerName: "Authorization ID", width: 210, cellClass: "font-mono text-xs" },
    { field: "captureId", headerName: "Capture ID", width: 210, cellClass: "font-mono text-xs" },
  ], []);

  return (
    <div style={{ height: 520 }}>
      <AgGridReact<Row>
        theme={theme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={{ sortable: true, resizable: true }}
        pagination
        paginationPageSize={20}
        paginationPageSizeSelector={false}
        overlayNoRowsTemplate="No milestones yet."
        onRowClicked={(e) => e.data && router.push(`/contracts/${e.data.contractId}`)}
        rowStyle={{ cursor: "pointer" }}
      />
    </div>
  );
}
