import test from "node:test";
import assert from "node:assert/strict";
import { __testables } from "../services/hisService.js";

const { chooseLookupTable, buildTableMapFromInfoSchemaRows } = __testables;

test("buildTableMapFromInfoSchemaRows groups table columns correctly", () => {
  const rows = [
    { TABLE_SCHEMA: "dbo", TABLE_NAME: "Mast_Dept", COLUMN_NAME: "iDept_id" },
    { TABLE_SCHEMA: "dbo", TABLE_NAME: "Mast_Dept", COLUMN_NAME: "cDept_Name" },
    { TABLE_SCHEMA: "dbo", TABLE_NAME: "Mast_User", COLUMN_NAME: "iUser_id" },
    { TABLE_SCHEMA: "", TABLE_NAME: "Broken", COLUMN_NAME: "x" }
  ];

  const tableMap = buildTableMapFromInfoSchemaRows(rows);
  assert.deepEqual(Object.keys(tableMap).sort(), ["dbo.Mast_Dept", "dbo.Mast_User"]);
  assert.equal(tableMap["dbo.Mast_Dept"]?.columns.has("iDept_id"), true);
  assert.equal(tableMap["dbo.Mast_Dept"]?.columns.has("cDept_Name"), true);
  assert.equal(tableMap["dbo.Mast_User"]?.columns.has("iUser_id"), true);
});

test("chooseLookupTable prefers hinted table with canonical columns", () => {
  const tableMap = {
    "dbo.RandomLookup": {
      schema: "dbo",
      table: "RandomLookup",
      columns: new Set(["DepartmentID", "DepartmentName"])
    },
    "dbo.Mast_Dept": {
      schema: "dbo",
      table: "Mast_Dept",
      columns: new Set(["iDept_id", "cDept_Name", "extra_col"])
    }
  };

  const picked = chooseLookupTable(
    tableMap,
    ["iDept_id", "DepartmentID", "iDeptId"],
    ["cDept_Name", "DepartmentName", "cName"],
    ["Mast_Dept", "Department", "Dept"]
  );

  assert.equal(picked?.table, "Mast_Dept");
  assert.equal(picked?.idCol, "iDept_id");
  assert.equal(picked?.nameCol, "cDept_Name");
});

test("chooseLookupTable returns null when required columns are absent", () => {
  const tableMap = {
    "dbo.OnlyIds": {
      schema: "dbo",
      table: "OnlyIds",
      columns: new Set(["iDept_id"])
    },
    "dbo.OnlyNames": {
      schema: "dbo",
      table: "OnlyNames",
      columns: new Set(["cDept_Name"])
    }
  };

  const picked = chooseLookupTable(
    tableMap,
    ["iDept_id", "DepartmentID", "iDeptId"],
    ["cDept_Name", "DepartmentName", "cName"],
    ["Mast_Dept", "Department", "Dept"]
  );

  assert.equal(picked, null);
});
