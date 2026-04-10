<?php

declare(strict_types=1);

/**
 * OP / IP patient viewer — configuration template.
 * Copy this file to `config.php` and set credentials (do not commit `config.php`).
 * Prefer a `.env` file (see ENV.example) — loaded automatically by bootstrap.php.
 * Override via env: OP_IP_DB_SERVER, OP_IP_DB_NAME, OP_IP_DB_USER, OP_IP_DB_PASS.
 *
 * Adjust `queries` and `op_columns` / `ip_columns` to match your real column names
 * (use SSMS or set discover_enabled in config.php and open discover_schema.php from localhost).
 */
return [
    'server' => getenv('OP_IP_DB_SERVER') ?: 'WIN-65URRV9USQE',
    'database' => getenv('OP_IP_DB_NAME') ?: 'KMCH_Frontoffice',
    'username' => getenv('OP_IP_DB_USER') ?: 'sa',
    // Password: copy Password= from Web.config BB_CONSTR (KMCH_Frontoffice / sa), or use .env OP_IP_DB_PASS.
    'password' => getenv('OP_IP_DB_PASS') ?: '',
    'connection_options' => [
        'CharacterSet' => 'UTF-8',
        'ReturnDatesAsStrings' => true,
        'Encrypt' => true,
        'TrustServerCertificate' => true,
    ],
    'queries' => [
        'patient_master' => '[dbo].[patient_master]',
        'op_reg' => '[dbo].[patient_opd_registration]',
        'ip_reg' => '[dbo].[patient_ipd_registration]',
        'op_join_condition' => 'op.PatientID = pm.PatientID',
        'ip_join_condition' => 'ip.PatientID = pm.PatientID',
        'op_date_column' => 'op.RegistrationDate',
        'ip_date_column' => 'ip.AdmissionDate',
        'patient_name_column' => 'pm.PatName',
        'patient_id_column' => 'pm.PatientID',
        'gender_column' => 'pm.Gender',
        'op_dept_column' => 'op.DepartmentID',
        'ip_ward_column' => 'ip.WardID',
    ],
    'op_columns' => [
        'OPD Reg ID' => 'op.OPDRegistrationID',
        'Patient ID' => 'pm.PatientID',
        'Name' => 'pm.PatName',
        'Reg Date' => 'op.RegistrationDate',
        'Dept' => 'op.DepartmentID',
    ],
    'ip_columns' => [
        'IP Reg No'  => 'ip.iIP_Reg_No',
        'Patient ID' => 'pm.iPat_id',
        'Name'       => 'pm.cPat_Name',
        'Gender'     => 'pm.cSex',
        'Admission'  => 'ip.dIP_dt',
        'Discharge'  => 'ip.dDisCharge_Dt',
        'Dept ID'    => 'ip.iDept_id',
        'Active'     => 'ip.bStatus',
    ],
    'op_sort_whitelist' => [
        'reg_date_desc' => 'op.RegistrationDate DESC',
        'reg_date_asc' => 'op.RegistrationDate ASC',
        'name_asc' => 'pm.PatName ASC',
        'name_desc' => 'pm.PatName DESC',
    ],
    'ip_sort_whitelist' => [
        'adm_date_desc' => 'ip.AdmissionDate DESC',
        'adm_date_asc' => 'ip.AdmissionDate ASC',
        'name_asc' => 'pm.PatName ASC',
        'name_desc' => 'pm.PatName DESC',
    ],
    'pagination' => [
        'default_page_size' => 25,
        'max_page_size' => 100,
    ],
    'discover_enabled' => false,
    /**
     * ODBC driver priority list (pdo_odbc on Windows).
     * Run `reg query "HKLM\SOFTWARE\ODBC\ODBCINST.INI\ODBC Drivers"` to see what's installed.
     * Legacy "SQL Server" driver is bundled with Windows. ODBC Driver 17/18 is preferred if installed.
     * Download: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server
     */
    'odbc_drivers_try' => [
        'SQL Server',
        'SQL Server Native Client 11.0',
        'ODBC Driver 17 for SQL Server',
        'ODBC Driver 18 for SQL Server',
    ],
];
