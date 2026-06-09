import * as XLSX from "xlsx";
import type { ProfileRole } from "@/lib/app-context";
import { shouldStripContactFromExcelExport } from "@/lib/role-rbac";
import {
  formatClientDate,
  formatClientDateTime,
  formatLastContacted,
  formatOwnerDisplayName,
} from "@/lib/secure-clients";
import type { SecureClientWithOwners } from "@/lib/secure-clients";

function rowToExportRecord(row: SecureClientWithOwners): Record<string, string | number> {
  return {
    "First Name": row.first_name ?? "",
    "Last Name": row.last_name ?? "",
    Country: row.country ?? "",
    Affiliate: row.affiliate ?? "",
    "Tp Account": row.tp_account ?? "",
    Phone: row.phone,
    Email: row.email ?? "",
    "Lead Status": row.lead_status ?? "",
    Owner: formatOwnerDisplayName(row.owner),
    "Total Calls":
      row.total_calls === null || row.total_calls === undefined
        ? ""
        : row.total_calls,
    "Previous Lead Status": row.previous_lead_status ?? "",
    "Previous Owner": formatOwnerDisplayName(row.previous_owner),
    "Created On": formatClientDate(row.created_on),
    "Last Assignment": formatClientDateTime(row.last_assignment),
    "Last Contacted": formatLastContacted(row.last_contacted),
    "Updated At": formatClientDate(row.updated_at),
  };
}

export function downloadClientsExcel(
  rows: SecureClientWithOwners[],
  profileRole: ProfileRole,
): void {
  const stripContact = shouldStripContactFromExcelExport(profileRole);

  const sheetRows = rows.map((row) => {
    const record = rowToExportRecord(row);
    if (stripContact) {
      delete record.Phone;
      delete record.Email;
    }
    return record;
  });

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");

  const suffix = stripContact ? "sin-contacto" : "completo";
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `clientes-${suffix}-${date}.xlsx`);
}
